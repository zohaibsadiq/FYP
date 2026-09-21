from django.contrib import admin

from .models import Friend, FriendRequest, Loan


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "status", "created_at")
    list_filter = ("status",)


@admin.register(Friend)
class FriendAdmin(admin.ModelAdmin):
    list_display = ("owner", "nickname", "person", "blocked", "created_at")
    list_filter = ("blocked",)
    search_fields = ("nickname",)


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("item", "lender", "borrower", "status", "borrow_until")
    list_filter = ("status",)
