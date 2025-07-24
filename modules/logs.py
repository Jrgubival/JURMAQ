import logging
from datetime import datetime
from typing import Dict, Any
from .utils import db

class LogManager:
    """Comprehensive logging system for audit trails."""
    
    @staticmethod
    def log_action(user: str, action: str, module: str, details: Dict[str, Any] = None):
        """Log an action performed by a user."""
        log_entry = {
            'user': user,
            'action': action,
            'module': module,
            'details': details or {},
            'timestamp': datetime.now().isoformat(),
            'ip_address': 'localhost'  # Could be enhanced to capture real IP
        }
        
        # Save to database
        log_id = f"LOG_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]}"
        db.add_record('logs', log_id, log_entry)
        
        # Also log to file
        logging.info(f"[{user}] {action} in {module} - {details}")
        
    @staticmethod
    def log_login(user: str, success: bool = True):
        """Log login attempts."""
        action = "LOGIN_SUCCESS" if success else "LOGIN_FAILED"
        LogManager.log_action(user, action, "AUTH")
        
    @staticmethod
    def log_logout(user: str):
        """Log logout."""
        LogManager.log_action(user, "LOGOUT", "AUTH")
        
    @staticmethod
    def log_create(user: str, module: str, record_type: str, record_id: str, data: Dict):
        """Log record creation."""
        LogManager.log_action(
            user, 
            "CREATE", 
            module, 
            {'type': record_type, 'id': record_id, 'data': data}
        )
        
    @staticmethod
    def log_update(user: str, module: str, record_type: str, record_id: str, changes: Dict):
        """Log record updates."""
        LogManager.log_action(
            user, 
            "UPDATE", 
            module, 
            {'type': record_type, 'id': record_id, 'changes': changes}
        )
        
    @staticmethod
    def log_delete(user: str, module: str, record_type: str, record_id: str):
        """Log record deletion."""
        LogManager.log_action(
            user, 
            "DELETE", 
            module, 
            {'type': record_type, 'id': record_id}
        )
        
    @staticmethod
    def log_pdf_generation(user: str, pdf_type: str, pdf_id: str):
        """Log PDF generation."""
        LogManager.log_action(
            user, 
            "PDF_GENERATED", 
            "PDF", 
            {'type': pdf_type, 'id': pdf_id}
        )
        
    @staticmethod
    def get_logs(start_date: str = None, end_date: str = None, user: str = None, module: str = None):
        """Retrieve logs with optional filters."""
        all_logs = db.get_all_records('logs')
        filtered_logs = {}
        
        for log_id, log_data in all_logs.items():
            # Apply filters
            if user and log_data.get('user') != user:
                continue
            if module and log_data.get('module') != module:
                continue
            if start_date and log_data.get('timestamp', '') < start_date:
                continue
            if end_date and log_data.get('timestamp', '') > end_date:
                continue
                
            filtered_logs[log_id] = log_data
            
        return filtered_logs
        
    @staticmethod
    def get_user_activity(user: str, days: int = 30):
        """Get user activity summary."""
        from datetime import datetime, timedelta
        
        start_date = (datetime.now() - timedelta(days=days)).isoformat()
        logs = LogManager.get_logs(start_date=start_date, user=user)
        
        activity_summary = {
            'total_actions': len(logs),
            'modules_used': set(),
            'actions_by_module': {},
            'last_login': None
        }
        
        for log_data in logs.values():
            module = log_data.get('module', 'UNKNOWN')
            action = log_data.get('action', 'UNKNOWN')
            
            activity_summary['modules_used'].add(module)
            
            if module not in activity_summary['actions_by_module']:
                activity_summary['actions_by_module'][module] = {}
            if action not in activity_summary['actions_by_module'][module]:
                activity_summary['actions_by_module'][module][action] = 0
            activity_summary['actions_by_module'][module][action] += 1
            
            if action == 'LOGIN_SUCCESS':
                if not activity_summary['last_login'] or log_data['timestamp'] > activity_summary['last_login']:
                    activity_summary['last_login'] = log_data['timestamp']
        
        activity_summary['modules_used'] = list(activity_summary['modules_used'])
        return activity_summary