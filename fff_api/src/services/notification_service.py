import logging
from typing import List
from src.domain.models.core import Member, Events, Carpool

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.logger = logger

    async def send_email(self, to_email: str, subject: str, content: str):
        """
        Simulate sending an email.
        In production, this would use SMTP or an API (SendGrid, SES...).
        """
        if not to_email:
            self.logger.warning(f"Attempted to send email to empty address. Subject: {subject}")
            return
            
        # Log the "Email"
        print(f"\n[EMAIL SIMULATION] To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Content: {content}\n")
        self.logger.info(f"Email sent to {to_email} | Subject: {subject}")

    async def notify_convocation(self, member: Member, event: Events, game_info: str = None):
        if not member.email:
            return
            
        subject = f"Convocation : Match du {event.start_date.strftime('%d/%m/%Y')}"
        
        content = f"""Bonjour {member.first_name},

Vous avez été sélectionné pour le match suivant :
Date : {event.start_date.strftime('%d/%m/%Y à %H:%M')}
Lieu : {event.location or 'Non défini'}
"""
        if game_info:
            content += f"Détails : {game_info}\n"
            
        content += "\nMerci de confirmer votre présence sur l'application."
        
        await self.send_email(member.email, subject, content)

    async def notify_carpool_created(self, driver: Member, event: Events):
        # Maybe notify all participants? Or just log?
        # Usually we don't notify everyone that a carpool is created unless they subscribed.
        # But we can simulate a "New Carpool Available" for those who are 'present' but no transport?
        pass

    async def notify_carpool_join(self, driver: Member, passenger: Member, carpool: Carpool):
        if not driver.email:
             return
             
        subject = f"Nouveau passager pour votre covoiturage"
        content = f"""Bonjour {driver.first_name},

{passenger.first_name} {passenger.last_name} a rejoint votre covoiturage.
Places restantes : {carpool.available_seats - len(carpool.passengers)}

Bonne route !"""
        
        await self.send_email(driver.email, subject, content)

    async def notify_match_event(self, game_id: str, action_type: str, details: str):
        """
        Send Push Notification for major match events (Goal, Red Card).
        """
        # In a real app, we would fetch all subscribers for this game/team.
        # For now, we simulate the push.
        
        title = "🔴 Carton Rouge !" if action_type == "RED_CARD" else "⚽ BUT !"
        message = f"{details}"
        
        print(f"\n[PUSH NOTIFICATION] Game: {game_id}")
        print(f"Title: {title}")
        print(f"Body: {message}")
        
        self.logger.info(f"PUSH SENT: {title} - {message} (Game {game_id})")

notification_service = NotificationService()
