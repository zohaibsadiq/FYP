from collections import OrderedDict

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """
    DRF ignores ?page_size unless page_size_query_param is set, which silently
    truncates any client that asks for a full list: the category dropdown needs
    all 33 rows, not the first page of 24.
    """

    page_size_query_param = "page_size"
    max_page_size = 200

    def get_paginated_response(self, data):
        response = OrderedDict([
            ("count", self.page.paginator.count),
            ("next", self.get_next_link()),
            ("previous", self.get_previous_link()),
            ("results", data),
        ])
        # Set when the search fell back to guessing at a misspelling. The screen
        # says so, otherwise a search for "shrt" returning a shirt and a shalwar
        # kameez looks like the filter is broken.
        if getattr(self.request, "spelling_guessed", False):
            response["spelling_guessed"] = True
        return Response(response)

    def get_paginated_response_schema(self, schema):
        schema = super().get_paginated_response_schema(schema)
        schema["properties"]["spelling_guessed"] = {
            "type": "boolean",
            "description": (
                "Present and true when nothing matched what was typed and the "
                "results are the closest spellings instead."
            ),
        }
        return schema
