import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict
from .utils import db, generate_id
from .logs import LogManager

class LoginManager:
    """Manages user authentication and sessions."""
    
    def __init__(self):
        self.current_user = None
        self.session_timeout = 480  # 8 hours in minutes
        self.setup_default_users()
        
    def setup_default_users(self):
        """Setup default users if they don't exist."""
        users = db.get_all_records('users')
        
        if not users:
            # Create default users
            default_users = {
                'admin': {
                    'username': 'admin',
                    'password': self.hash_password('admin123'),
                    'role': 'admin',
                    'full_name': 'Administrador',
                    'email': 'admin@jurmaq.cl',
                    'active': True
                },
                'secretaria': {
                    'username': 'secretaria',
                    'password': self.hash_password('secre123'),
                    'role': 'secretaria',
                    'full_name': 'Secretaria',
                    'email': 'secretaria@jurmaq.cl',
                    'active': True
                },
                'operador': {
                    'username': 'operador',
                    'password': self.hash_password('opera123'),
                    'role': 'operador',
                    'full_name': 'Operador',
                    'email': 'operador@jurmaq.cl',
                    'active': True
                }
            }
            
            for user_id, user_data in default_users.items():
                db.add_record('users', user_id, user_data)
                
    def hash_password(self, password: str) -> str:
        """Hash password using SHA-256."""
        return hashlib.sha256(password.encode()).hexdigest()
        
    def authenticate(self, username: str, password: str) -> bool:
        """Authenticate user credentials."""
        user = db.get_record('users', username)
        
        if not user:
            LogManager.log_login(username, False)
            return False
            
        if not user.get('active', False):
            LogManager.log_login(username, False)
            return False
            
        password_hash = self.hash_password(password)
        if user.get('password') == password_hash:
            self.current_user = user
            self.create_session(username)
            LogManager.log_login(username, True)
            return True
        else:
            LogManager.log_login(username, False)
            return False
            
    def create_session(self, username: str):
        """Create a new user session."""
        session_data = {
            'username': username,
            'login_time': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(minutes=self.session_timeout)).isoformat(),
            'session_id': generate_id('SESSION')
        }
        
        db.add_record('sessions', username, session_data)
        
    def logout(self):
        """Logout current user."""
        if self.current_user:
            username = self.current_user['username']
            LogManager.log_logout(username)
            
            # Remove session
            db.delete_record('sessions', username)
            self.current_user = None
            
    def is_session_valid(self, username: str) -> bool:
        """Check if user session is still valid."""
        session = db.get_record('sessions', username)
        if not session:
            return False
            
        expires_at = datetime.fromisoformat(session['expires_at'])
        return datetime.now() < expires_at
        
    def get_current_user(self) -> Optional[Dict]:
        """Get current logged-in user."""
        return self.current_user
        
    def has_permission(self, required_role: str) -> bool:
        """Check if current user has required permission."""
        if not self.current_user:
            return False
            
        user_role = self.current_user.get('role')
        
        # Role hierarchy: admin > secretaria > operador
        role_levels = {
            'operador': 1,
            'secretaria': 2,
            'admin': 3
        }
        
        user_level = role_levels.get(user_role, 0)
        required_level = role_levels.get(required_role, 0)
        
        return user_level >= required_level
        
    def change_password(self, username: str, old_password: str, new_password: str) -> bool:
        """Change user password."""
        user = db.get_record('users', username)
        if not user:
            return False
            
        old_hash = self.hash_password(old_password)
        if user.get('password') != old_hash:
            return False
            
        new_hash = self.hash_password(new_password)
        db.update_record('users', username, {'password': new_hash})
        
        LogManager.log_action(
            self.current_user['username'] if self.current_user else username,
            'PASSWORD_CHANGE',
            'AUTH',
            {'target_user': username}
        )
        
        return True
        
    def create_user(self, username: str, password: str, role: str, full_name: str, email: str) -> bool:
        """Create a new user (admin only)."""
        if not self.has_permission('admin'):
            return False
            
        if db.get_record('users', username):
            return False  # User already exists
            
        user_data = {
            'username': username,
            'password': self.hash_password(password),
            'role': role,
            'full_name': full_name,
            'email': email,
            'active': True
        }
        
        db.add_record('users', username, user_data)
        
        LogManager.log_create(
            self.current_user['username'],
            'USER_MANAGEMENT',
            'USER',
            username,
            {'role': role, 'full_name': full_name, 'email': email}
        )
        
        return True
        
    def deactivate_user(self, username: str) -> bool:
        """Deactivate a user (admin only)."""
        if not self.has_permission('admin'):
            return False
            
        user = db.get_record('users', username)
        if not user:
            return False
            
        db.update_record('users', username, {'active': False})
        
        LogManager.log_action(
            self.current_user['username'],
            'USER_DEACTIVATED',
            'USER_MANAGEMENT',
            {'target_user': username}
        )
        
        return True
        
    def get_all_users(self) -> Dict:
        """Get all users (admin and secretaria only)."""
        if not self.has_permission('secretaria'):
            return {}
            
        return db.get_all_records('users')

# Global login manager instance
login_manager = LoginManager()