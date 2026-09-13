from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html

from .models import Category, GarmentItem, StorageLocation


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slot", "owner", "sort_order")
    list_filter = ("slot",)
    search_fields = ("name",)
    ordering = ("sort_order", "name")


@admin.register(StorageLocation)
class StorageLocationAdmin(admin.ModelAdmin):
    list_display = ("full_path", "kind", "owner", "item_count")
    list_filter = ("kind",)
    search_fields = ("name", "owner__email")
    autocomplete_fields = ("parent",)
    # full_path walks up to three parents, and without this each step is its
    # own query on every row of the list.
    list_select_related = ("owner", "parent", "parent__parent", "parent__parent__parent")

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_items=Count("items"))

    @admin.display(description="Items", ordering="_items")
    def item_count(self, obj):
        return obj._items


@admin.register(GarmentItem)
class GarmentItemAdmin(admin.ModelAdmin):
    list_display = (
        "thumbnail", "name", "category", "owner",
        "status", "color_swatch", "location_path", "wear_count",
    )
    list_display_links = ("thumbnail", "name")
    list_filter = ("status", "category__slot", "category", "is_favorite", "pattern")
    search_fields = ("name", "brand", "owner__email", "notes")
    autocomplete_fields = ("storage_location",)
    readonly_fields = ("wear_count", "last_worn_date", "created_at", "updated_at", "preview")
    list_select_related = ("category", "owner", "storage_location")

    fieldsets = (
        ("Identity", {"fields": ("owner", "name", "category", "brand", "size", "material", "pattern")}),
        ("Images", {"fields": ("preview", "original_image_url", "clean_image_url")}),
        ("Colour", {"fields": ("primary_color_hex", "primary_color_name", "secondary_color_hex")}),
        ("Context for the suggestion engine", {
            "fields": ("seasons", "occasions", "warmth_level", "is_waterproof"),
        }),
        ("Where it is", {"fields": ("storage_location", "status", "is_favorite")}),
        ("Money", {"fields": ("purchase_price", "currency", "purchase_date")}),
        ("Usage", {"fields": ("wear_count", "last_worn_date")}),
        ("Other", {"fields": ("notes", "created_at", "updated_at")}),
    )

    @admin.display(description="")
    def thumbnail(self, obj):
        url = obj.display_image_url
        if not url:
            return "-"
        return format_html(
            '<img src="{}" style="height:44px;width:44px;object-fit:contain;'
            'background:#f4f4f5;border-radius:6px" />',
            url,
        )

    @admin.display(description="Colour")
    def color_swatch(self, obj):
        if not obj.primary_color_hex:
            return "-"
        return format_html(
            '<span style="display:inline-flex;align-items:center;gap:6px">'
            '<span style="width:14px;height:14px;border-radius:3px;border:1px solid #ccc;'
            'background:{}"></span>{}</span>',
            obj.primary_color_hex,
            obj.primary_color_name or obj.primary_color_hex,
        )

    @admin.display(description="Preview")
    def preview(self, obj):
        if not obj.display_image_url:
            return "No image uploaded yet."
        return format_html(
            '<img src="{}" style="max-height:260px;background:#f4f4f5;border-radius:8px" />',
            obj.display_image_url,
        )
