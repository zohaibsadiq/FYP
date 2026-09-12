"""
Serializers = the translator between JSON (what Next.js sends/receives)
and Python objects (what Django works with).

They also do validation. If a password is too short, the serializer rejects it
before anything touches the database.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Used to SHOW a user (GET /api/auth/me/) and to UPDATE their profile.
    Notice `email` is read-only: changing your login email is a separate,
    more sensitive flow that we are not building.
    """

    display_name = serializers.CharField(read_only=True)
    has_body_photo = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "display_name",
            "city",
            "country_code",
            "body_photo_url",
            "has_body_photo",
            "date_joined",
        ]
        read_only_fields = ["id", "email", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    """
    Used for POST /api/auth/register/.

    `write_only=True` means the password is accepted as input but NEVER
    sent back in a response.
    """

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = ["email", "full_name", "password", "password_confirm", "city", "country_code"]

    def validate_email(self, value):
        """Stop two people registering with the same email in different letter cases."""
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate(self, attrs):
        """Runs after the individual field checks. Good place for cross-field rules."""
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        # Django's built-in rules: not too short, not all numbers, not a common password
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")          # not a model field
        password = validated_data.pop("password")
        # create_user() hashes the password for us
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """
    Used for POST /api/auth/login/.

    By default simplejwt returns only {access, refresh}. We also return the user
    object, so the frontend does not have to make a second call to /me/ right
    after logging in. Small thing, but it makes the login feel instant.
    """

    username_field = "email"

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
