import json
import os
import logging
from datetime import datetime
from io import BytesIO
from typing import Any
from minio import Minio
from src.domain.ports.storage import RawStorage

logger = logging.getLogger(__name__)

class MinioStorageService(RawStorage):
    def __init__(self):
        self.endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
        self.access_key = os.getenv("MINIO_ROOT_USER", "minioadmin")
        self.secret_key = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin")
        self.bucket_name = os.getenv("MINIO_BUCKET_NAME", "fff-data")
        
        # Determine secure flag
        secure_env = os.getenv("MINIO_SECURE", "false").lower()
        self.secure = secure_env == "true"
        
        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=self.secure
        )
        
        self._ensure_bucket_exists()
        
        self.run_date = datetime.now()

    def save_raw_json(self, data: Any, club_id: str, file_type: str, date_str: str = None) -> str:
        """
        Saves raw JSON data to MinIO with structure: raw/YYYY-MM-DD/club_id/file_type.json
        """
        if date_str is None:
            date_str = self.run_date.strftime("%Y-%m-%d")
            
        object_name = f"raw/{date_str}/{club_id}/{file_type}.json"
        
        json_bytes = json.dumps(data, ensure_ascii=False).encode('utf-8')
        data_stream = BytesIO(json_bytes)
        
        self.client.put_object(
            self.bucket_name,
            object_name,
            data_stream,
            len(json_bytes),
            content_type="application/json"
        )
        logger.info(f"Saved {object_name} to MinIO")
        return object_name

    def exists_raw_json(self, category: str, club_id: str, file_type: str, date_str: str = None) -> bool:
        """Checks if a raw JSON file exists."""
        if date_str is None:
            date_str = self.run_date.strftime("%Y-%m-%d")
        object_name = f"raw/{category}/{date_str}/{club_id}/{file_type}.json"
        print(f"Checking existence of {object_name}")
        return self.file_exists(object_name)

    def load_raw_json(self, object_path: str) -> Any:
        """Loads a JSON file directly from a specific MinIO path."""
        try:
            response = self.client.get_object(self.bucket_name, object_path)
            return json.loads(response.read())
        finally:
            if 'response' in locals():
                response.close()
                
    def list_files(self, category: str, date_str: str = None) -> list[str]:
        """Lists all files for a specific date (or today)."""
        if date_str is None:
            date_str = self.run_date.strftime("%Y-%m-%d")
        
        prefix = f"raw/{category}/{date_str}/"
        objects = self.client.list_objects(self.bucket_name, prefix=prefix, recursive=True)
        return [obj.object_name for obj in objects]

    def _ensure_bucket_exists(self):
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                logger.info(f"Created bucket {self.bucket_name}")
        except Exception as e:
            logger.error(f"Error checking/creating bucket: {e}")
            # Depending on policy, we might want to suppress this or let it crash
            # For now, let's log it. In a container environment, MinIO might not be ready instantly.

    def file_exists(self, path: str) -> bool:
        try:
            self.client.stat_object(self.bucket_name, path)
            return True
        except:
            return False

    def read_json(self, path: str) -> Any:
        try:
            response = self.client.get_object(self.bucket_name, path)
            data = json.loads(response.read())
            response.release_conn()
            return data
        except Exception as e:
            logger.error(f"Error reading {path}: {e}")
            raise e

    def save_raw(self, category: str, name: str, data: Any):
        """
        Saves raw data to MinIO.
        Path format: raw/{date}/{category}/{name}.json
        """
        
        date_str = self.run_date.strftime("%Y-%m-%d")
        
        # Ensure name doesn't start with / to avoid double slashes if user provided one
        if name.startswith("/"):
            name = name[1:]
            
        path = f"raw/{category}/{date_str}/{name}.json"
        self._save_json(path, data)

    def single_save(self,  name: str, data: Any):
        """
        Saves raw data to MinIO.
        Path format: raw/{date}/{category}/{name}.json
        """
        date_str = self.run_date.strftime("%Y-%m-%d")
        
        # Ensure name doesn't start with / to avoid double slashes if user provided one
        if name.startswith("/"):
            name = name[1:]
            
        path = f"all_clubs//{name}.json"
        self._save_json(path, data)

    def _save_json(self, path: str, data: Any):
        try:
            content = json.dumps(data, indent=2)
                
            content_bytes = content.encode('utf-8')
            data_stream = BytesIO(content_bytes)
            
            self.client.put_object(
                self.bucket_name,
                path,
                data_stream,
                length=len(content_bytes),
                content_type="application/json"
            )
            # logger.info(f"Saved {path}")
        except Exception as e:
            logger.error(f"Failed to save {path} to MinIO: {e}")
            raise e

    def concatenate_json_files(self, prefix: str, output_path: str, delete_source_files: bool = False):
        """
        Concatenates all JSON files found under the specified prefix into a single file.
        The result is a list containing all the data from the individual files.
        If a file contains a list, its elements are extended to the main list.
        If a file contains an object, it is appended to the main list.
        The output file will have the current timestamp (YYYYMMDD_HHMMSS) appended to its name.

        Args:
            prefix: The MinIO prefix (folder) to search in.
            output_path: The base path for the output JSON file. Timestamp will be injected before extension.
            delete_source_files: If True, deletes the source files after successful concatenation.
        """
        if output_path.startswith("/"):
            output_path = output_path[1:]

        # Add timestamp to output filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name, ext = os.path.splitext(output_path)
        if not ext:
            ext = ".json"
        
        final_output_path = f"{base_name}_{timestamp}{ext}"

        combined_data = []
        processed_files = []
        objects = self.client.list_objects(self.bucket_name, prefix=prefix, recursive=True)
        
        for obj in objects:
            # Skip if it's the output file itself
            if obj.object_name == final_output_path:
                continue

            if not obj.object_name.endswith('.json'):
                continue
                
            try:
                data = self.read_json(obj.object_name)
                if isinstance(data, list):
                    combined_data.extend(data)
                else:
                    combined_data.append(data)
                processed_files.append(obj.object_name)
            except Exception as e:
                logger.error(f"Error processing file {obj.object_name} during concatenation: {e}")
                
        if combined_data:
            self._save_json(final_output_path, combined_data)
            logger.info(f"Concatenated files from {prefix} to {final_output_path}")
            
            if delete_source_files:
                for file_path in processed_files:
                    try:
                        self.client.remove_object(self.bucket_name, file_path)
                    except Exception as e:
                        logger.error(f"Error deleting file {file_path}: {e}")
                logger.info(f"Deleted {len(processed_files)} source files.")
        else:
            logger.warning(f"No data found or no valid JSON files with prefix {prefix}")

