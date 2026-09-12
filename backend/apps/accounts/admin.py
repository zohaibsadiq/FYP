"""
Registers the User model in Django's admin panel (http://localhost:8000/admin/).

You will use the admin a LOT during development: adding test users, checking
data, fixing a wrong value without writing a single line of code.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    # Columns shown in the user list
    list_display = ("email", "full_name", "city", "is_staff", "date_joined")
    list_filter = ("is_staff", "is_superuser", "is_active")
    search_fields = ("email", "full_name", "city")
    ordering = ("-date_joined",)

    # How the edit form is grouped. We have to redefine this because Django's
    # default version refers to "username", which our model does not have.
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("full_name",)}),
        ("Location (for weather)", {"fields": ("city", "country_code")}),
        ("Virtual Try-On", {"fields": ("body_photo_url",)}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    # The form shown when clicking "Add user" in the admin
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "password1", "password2"),
            },
        ),
    )
