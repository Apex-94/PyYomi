"""Encryption service for secure token storage"""
import os
import base64
from cryptography.fernet import Fernet


class EncryptionService:
    """Service for encrypting and decrypting sensitive data like OAuth tokens"""

    def __init__(self):
        key = os.environ.get("ENCRYPTION_KEY") or base64.urlsafe_b64encode(os.urandom(32)).decode()
        self.cipher = Fernet(key.encode())

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a plaintext string and return the ciphertext"""
        return plaintext and self.cipher.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt a ciphertext string and return the plaintext"""
        return ciphertext and self.cipher.decrypt(ciphertext.encode()).decode()


# Singleton instance
encryption_service = EncryptionService()
