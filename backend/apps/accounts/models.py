"""
Custom User model.

WHY we write our own instead of using Django's default:
Django's default user logs in with a *username*. Modern apps log in with
*email*. Changing this later is very painful, so we do it on day one.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """
    Tells Django HOW to create users, now that 'username' no longer exists.
    Django calls create_user() on signup and create_superuser() when you run
    `manage.py createsuperuser`.
    """

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)          # lowercases the domain part
        user = self.model(email=email, **extra_fields)
        user.set_password(password)                  # hashes it, never stores plain text
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    One row per person using the app.

    We keep profile fields (city, body photo) on the User itself rather than in
    a separate Profile table. The project is not big enough to justify the extra
    table, and it means one less database JOIN on every page load.
    """

    # ---- Login ----
    username = None                                  # we don't use usernames
    email = models.EmailField(unique=True)

    # ---- Identity ----
    full_name = models.CharField(max_length=150, blank=True)

    # ---- Used by the weather feature (Phase 3) ----
    city = models.CharField(
        max_length=100,
        blank=True,
        help_text="City used to fetch the weather forecast, e.g. 'Lahore'",
    )
    country_code = models.CharField(
        max_length=2,
        blank=True,
        help_text="Two-letter country code, e.g. 'PK'",
    )

    # ---- Used by Virtual Try-On (Phase 5) ----
    body_photo_url = models.URLField(
        blank=True,
        help_text="Full-body front-facing photo. The try-on model draws clothes onto this.",
    )

    USERNAME_FIELD = "email"        # this is what you type to log in
    REQUIRED_FIELDS = []            # extra prompts for createsuperuser (none needed)

    objects = UserManager()

    class Meta:
        db_table = "users"
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email

    @property
    def display_name(self):
        """What the frontend shows in the navbar."""
        return self.full_name or self.email.split("@")[0]

    @property
    def has_body_photo(self):
        """Try-On page uses this to decide whether to ask for a photo first."""
        return bool(self.body_photo_url)
