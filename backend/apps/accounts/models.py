"""Email is the login identifier in place of username. Django rules out swapping
AUTH_USER_MODEL once the initial migration has run, so the substitution is made
here rather than left to a later refactor.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
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
    username = None
    email = models.EmailField(unique=True)

    full_name = models.CharField(max_length=150, blank=True)

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

    # Which part of a clothes shop somebody wants to see. Asked as a
    # preference rather than as an identity, because a woman may be buying for
    # her son and a man may be selling his sister's kurta; what the app needs
    # is which section to open on, nothing more.
    class ShoppingFor(models.TextChoices):
        WOMEN = "WOMEN", "Women's clothes"
        MEN = "MEN", "Men's clothes"
        KIDS = "KIDS", "Children's clothes"
        EVERYTHING = "EVERYTHING", "Everything"

    shopping_for = models.CharField(
        max_length=12,
        choices=ShoppingFor.choices,
        default=ShoppingFor.EVERYTHING,
        help_text="Which clothes to show first. Every page can still be switched to anything else.",
    )

    # Never listed, never searchable, and never sent with a listing. It is
    # handed over to exactly one person, at the moment a seller accepts their
    # offer, so the two of them can arrange the handover.
    phone = models.CharField(
        max_length=30,
        blank=True,
        help_text="Shown to one buyer or seller only, once you have agreed to deal with them.",
    )

    body_photo_url = models.URLField(
        blank=True,
        help_text="Full-body front-facing photo. The try-on model draws clothes onto this.",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "users"
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email

    @property
    def display_name(self):
        return self.full_name or self.email.split("@")[0]

    @property
    def has_body_photo(self):
        return bool(self.body_photo_url)
