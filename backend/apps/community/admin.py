from django.contrib import admin
from django.utils import timezone

from .models import Block, Enquiry, Listing, Report


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("item", "seller", "asking_price", "condition", "city", "status", "created_at")
    list_filter = ("status", "condition", "city")
    search_fields = ("item__name", "item__brand", "seller__email", "note")
    list_select_related = ("item", "seller")
    readonly_fields = ("created_at", "updated_at", "closed_at")
    date_hierarchy = "created_at"


@admin.register(Enquiry)
class EnquiryAdmin(admin.ModelAdmin):
    list_display = ("listing", "buyer", "status", "created_at", "answered_at")
    list_filter = ("status",)
    search_fields = ("buyer__email", "listing__item__name", "message")
    list_select_related = ("listing", "buyer")
    readonly_fields = ("created_at", "answered_at")


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("blocker", "blocked", "created_at")
    search_fields = ("blocker__email", "blocked__email")
    list_select_related = ("blocker", "blocked")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    """Reports are read here and acted on by hand. Nothing hides itself."""

    list_display = ("listing", "reporter", "reason", "created_at", "is_reviewed")
    list_filter = ("reason", "reviewed_at")
    search_fields = ("listing__item__name", "reporter__email", "note")
    list_select_related = ("listing", "reporter")
    actions = ["mark_reviewed"]

    @admin.display(description="Looked at", boolean=True)
    def is_reviewed(self, obj):
        return obj.reviewed_at is not None

    @admin.action(description="Mark the selected reports as looked at")
    def mark_reviewed(self, request, queryset):
        updated = queryset.update(reviewed_at=timezone.now())
        self.message_user(request, f"{updated} marked as looked at.")
