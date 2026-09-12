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
