from django.contrib import admin

from .models import TryOn


@admin.register(TryOn)
class TryOnAdmin(admin.ModelAdmin):
    list_display = ("owner", "item", "status", "provider", "created_at")
    list_filter = ("status", "provider")
    readonly_fields = ("created_at", "completed_at")
