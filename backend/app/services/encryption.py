"""Encryption service for secure token storage"""
import os
import base64
from cryptography.fernet import Fernet


class EncryptionService:
    """Service for encrypting and decrypting sensitive data like OAuth tokens"""

    def __init__(self):
        key = os.environ.get("ENCRYPTION_KEY") or self._load_or_create_local_key()
        self.cipher = Fernet(key.encode())

    @staticmethod
    def _key_file_path() -> str:
        backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        return os.path.join(backend_root, ".encryption_key")

    def _load_or_create_local_key(self) -> str:
        key_file = self._key_file_path()
        if os.path.exists(key_file):
            with open(key_file, "r", encoding="utf-8") as f:
                return f.read().strip()
        key = base64.urlsafe_b64encode(os.urandom(32)).decode()
        with open(key_file, "w", encoding="utf-8") as f:
            f.write(key)
        return key

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a plaintext string and return the ciphertext"""
        return plaintext and self.cipher.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt a ciphertext string and return the plaintext"""
        return ciphertext and self.cipher.decrypt(ciphertext.encode()).decode()


# Singleton instance
encryption_service = EncryptionService()
