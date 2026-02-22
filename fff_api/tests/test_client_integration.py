import pytest
from src.infrastructure.clients.fff.client import FFFClient

@pytest.mark.asyncio
class TestFFFClientIntegration:
    CLUB_ID = 112966
    MATCH_ID = 53398269
    COMPETITION_ID = 442351
    PHASE_ID = 1
    POULE_ID = 2
    FILTER_ID = 36

    async def test_get_club_last_results(self):
        async with FFFClient() as client:
            results = await client.get_club_last_results(self.CLUB_ID)
            assert results is not None
            assert isinstance(results, dict)
            assert 'hydra:member' in results
            
            # Check structure of first result if available
            members = results['hydra:member']
            if members:
                match = members[0]
                assert 'home' in match
                assert 'away' in match

    async def test_get_club_matches(self):
        async with FFFClient() as client:
            # get_club_matches returns a list of pages (dicts)
            matches_pages = await client.get_club_matches(self.CLUB_ID, page=1)
            assert matches_pages is not None
            assert isinstance(matches_pages, list)
            if matches_pages:
                page = matches_pages[0]
                assert isinstance(page, dict)
                assert 'hydra:member' in page

    async def test_get_match_details(self):
        async with FFFClient() as client:
            match_detail = await client.get_match_details(self.MATCH_ID)
            assert match_detail is not None
            assert isinstance(match_detail, dict)
            assert 'competition' in match_detail
            assert 'home' in match_detail
            assert 'away' in match_detail

    async def test_get_club_calendar(self):
        async with FFFClient() as client:
            calendar = await client.get_club_calendar(self.CLUB_ID)
            assert calendar is not None
            assert isinstance(calendar, dict)
            assert 'hydra:member' in calendar

    async def test_get_club_teams(self):
        async with FFFClient() as client:
            # This returns the raw API response (dict with hydra:member) or a list? 
            # In ScrapeClubTeamsUseCase: data = await self.data_provider.get(...) -> returns dict
            result = await client.get_club_teams(self.CLUB_ID, filter_val=self.FILTER_ID)
            
            assert result is not None
            assert isinstance(result, dict)
            assert 'hydra:member' in result
            
            teams = result['hydra:member']
            assert isinstance(teams, list)
            if teams:
                assert 'short_name' in teams[0]

    async def test_get_competition_results(self):
        async with FFFClient() as client:
            comp_results = await client.get_competition_results(self.COMPETITION_ID, self.PHASE_ID, self.POULE_ID)
            assert comp_results is not None
            assert isinstance(comp_results, dict)
            assert 'hydra:member' in comp_results

    async def test_get_competition_ranking(self):
        async with FFFClient() as client:
            ranking = await client.get_competition_ranking(self.COMPETITION_ID, self.PHASE_ID, self.POULE_ID)
            assert ranking is not None
            assert isinstance(ranking, dict)
            assert 'hydra:member' in ranking
            
            members = ranking['hydra:member']
            if members:
                assert 'rank' in members[0]

