from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
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
            "shopping_for",
            # Only the account's own page (MeView) uses this serializer, so the
            # phone number is only ever shown to the person it belongs to.
            "phone",
            # Starts off. A new account shares nothing with anybody until the
            # person switches it on.
            "shares_closet",
            "body_photo_url",
            "has_body_photo",
            "date_joined",
        ]
        read_only_fields = ["id", "email", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
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
        fields = [
            "email", "full_name", "password", "password_confirm",
            "city", "country_code", "shopping_for",
        ]

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """
    Signs people in with their email instead of a username, and sends the
    account details back together with the tokens.

    The library on its own returns only the two tokens. The browser would then
    need a second request just to learn the person's name before it can draw
    the page. Sending the account along saves that round trip.
    """

    username_field = "email"

    def validate(self, attrs):
        # Emails are stored in lower case and the login check compares them
        # exactly. A phone keyboard often capitalises the first letter, so
        # "Ali@example.com" must still match "ali@example.com". Without this,
        # people would be locked out of their own account with a "No active
        # account found" message.
        if attrs.get(self.username_field):
            attrs[self.username_field] = attrs[self.username_field].lower().strip()

        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
