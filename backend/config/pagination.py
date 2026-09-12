from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """
    DRF ignores ?page_size unless page_size_query_param is set, which silently
    truncates any client that asks for a full list: the category dropdown needs
    all 33 rows, not the first page of 24.
    """

    page_size_query_param = "page_size"
    max_page_size = 200
