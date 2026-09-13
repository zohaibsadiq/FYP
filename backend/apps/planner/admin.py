from django.contrib import admin

from .models import PlannedOutfit


@admin.register(PlannedOutfit)
class PlannedOutfitAdmin(admin.ModelAdmin):
    list_display = ("planned_for", "label", "owner", "is_confirmed")
    list_filter = ("planned_for", "worn_confirmed_at")
    search_fields = ("label", "note", "owner__email")
    date_hierarchy = "planned_for"
    filter_horizontal = ("items",)
    list_select_related = ("owner",)

    @admin.display(description="Confirmed as worn", boolean=True)
    def is_confirmed(self, obj):
        return obj.is_confirmed
