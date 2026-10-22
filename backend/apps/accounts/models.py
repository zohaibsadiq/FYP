"""
People sign in with their email address. There is no username.

Django lets a project choose its own user table, but only before the first
database migration has run. That is why this file was written on day one
instead of being added later.
"""

import secrets

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

# Letters and digits that are easy to tell apart. There is no 0 or O, and no
# 1, I or L. A friend code gets read out over the phone or typed from a screen,
# and those are the characters people mix up.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


def new_friend_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


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

    # Which section of a clothes shop to open first. It is a preference, not a
    # statement about who the person is. Example: a mother shopping for her son
    # picks "Children's clothes", and a man selling his sister's kurta switches
    # to "Women's clothes" for that one listing.
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

    # The phone number is private. It never appears in a listing or a search.
    # It is shown to exactly one other person, at the moment a seller accepts
    # that person's offer, so the two of them can arrange the handover.
    phone = models.CharField(
        max_length=30,
        blank=True,
        help_text="Shown to one buyer or seller only, once you have agreed to deal with them.",
    )

    body_photo_url = models.URLField(
        blank=True,
        help_text="Full-body front-facing photo. The try-on model draws clothes onto this.",
    )
    # Cloudinary, the image host, files each picture under its own id. Deleting
    # a picture needs that id rather than the web address, so it is kept here.
    body_photo_public_id = models.CharField(max_length=255, blank=True)
    # A photo of somebody's body is sent to another company to be processed.
    # This date records that the person was told so and agreed. Clearing it
    # takes the permission back.
    body_photo_consent_at = models.DateTimeField(null=True, blank=True)

    # Friends are added by sharing this code, in person or by message.
    # Example: Ali tells Sara "my code is K7MNP3QX", Sara types it in, and a
    # request reaches Ali. There is no search by name or email on purpose. A
    # name search cannot tell a real person from somebody copying their name,
    # and an email search would let anybody check whether an address has an
    # account here.
    #
    # The column starts empty rather than with a default value. Every code must
    # be unique, and Postgres cannot give all the existing accounts the same
    # starting value in a unique column. Empty values are allowed to repeat, so
    # ensure_friend_code() fills the code in the first time it is needed.
    friend_code = models.CharField(
        max_length=16,
        unique=True,
        null=True,
        blank=True,
        default=None,
        help_text="Give this to somebody you want as a friend. Change it any time.",
    )

    shares_closet = models.BooleanField(
        default=False,
        help_text="Off until you turn it on. Friends see nothing of yours until then.",
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

    def ensure_friend_code(self) -> str:
        """Returns the code, making one first if the person never had one."""
        if not self.friend_code:
            self.reissue_friend_code()
        return self.friend_code

    def reissue_friend_code(self) -> str:
        """
        Replaces the code with a new one. The old code stops working, so
        somebody who saw it over a shoulder can no longer use it to send a
        request.
        """
        # With 31 characters in 8 places there are about 850 billion possible
        # codes, so two people getting the same one is very unlikely. It is
        # still possible, and a crash on a button press is worse than trying
        # again, so this tries up to ten times.
        for _ in range(10):
            candidate = new_friend_code()
            if not User.objects.filter(friend_code=candidate).exists():
                self.friend_code = candidate
                self.save(update_fields=["friend_code"])
                return self.friend_code
        raise RuntimeError("Could not find a free friend code")
