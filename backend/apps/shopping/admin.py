from django.contrib import admin

from .models import Deal, PriceChange, Shop, SyncRun


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "last_result", "last_checked_at", "listed_deals")
    list_filter = ("is_active", "last_result", "feed_kind")
    search_fields = ("name", "slug", "site_url")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("last_checked_at", "last_result", "last_message", "created_at")

    @admin.display(description="Listed products")
    def listed_deals(self, obj):
        return obj.deals.filter(is_listed=True).count()


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ("title", "shop", "price", "was_price", "discount_percent", "in_stock", "is_listed")
    list_filter = ("shop", "slot", "is_listed", "in_stock", "category")
    search_fields = ("title", "vendor", "shop_category", "external_id")
    list_select_related = ("shop", "category")
    readonly_fields = ("first_seen_at", "checked_at", "price_fell_at", "external_id")


@admin.register(PriceChange)
class PriceChangeAdmin(admin.ModelAdmin):
    list_display = ("deal", "price", "was_price", "noticed_at")
    list_filter = ("noticed_at",)
    list_select_related = ("deal",)
    date_hierarchy = "noticed_at"


@admin.register(SyncRun)
class SyncRunAdmin(admin.ModelAdmin):
    list_display = ("shop", "started_at", "ok", "found", "added", "updated", "delisted", "seconds_taken")
    list_filter = ("ok", "shop")
    list_select_related = ("shop",)
    date_hierarchy = "started_at"
