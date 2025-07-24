import json
import os
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

class DatabaseManager:
    """Manages JSON-based data storage for the JURMAQ system."""
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.ensure_data_dir()
        self.setup_logging()
        
    def ensure_data_dir(self):
        """Ensure data directory exists."""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
            
    def setup_logging(self):
        """Setup logging configuration."""
        log_dir = os.path.join(self.data_dir, "logs")
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
            
        log_file = os.path.join(log_dir, f"jurmaq_{datetime.now().strftime('%Y%m%d')}.log")
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        
    def get_file_path(self, table_name: str) -> str:
        """Get the file path for a given table."""
        return os.path.join(self.data_dir, f"{table_name}.json")
        
    def load_data(self, table_name: str) -> Dict:
        """Load data from JSON file."""
        file_path = self.get_file_path(table_name)
        try:
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logging.error(f"Error loading data from {table_name}: {e}")
            return {}
            
    def save_data(self, table_name: str, data: Dict):
        """Save data to JSON file."""
        file_path = self.get_file_path(table_name)
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logging.info(f"Data saved to {table_name}")
        except Exception as e:
            logging.error(f"Error saving data to {table_name}: {e}")
            
    def add_record(self, table_name: str, record_id: str, record_data: Dict):
        """Add a new record to a table."""
        data = self.load_data(table_name)
        record_data['created_at'] = datetime.now().isoformat()
        record_data['updated_at'] = datetime.now().isoformat()
        data[record_id] = record_data
        self.save_data(table_name, data)
        logging.info(f"Record {record_id} added to {table_name}")
        
    def update_record(self, table_name: str, record_id: str, record_data: Dict):
        """Update an existing record."""
        data = self.load_data(table_name)
        if record_id in data:
            data[record_id].update(record_data)
            data[record_id]['updated_at'] = datetime.now().isoformat()
            self.save_data(table_name, data)
            logging.info(f"Record {record_id} updated in {table_name}")
        else:
            logging.warning(f"Record {record_id} not found in {table_name}")
            
    def delete_record(self, table_name: str, record_id: str):
        """Delete a record from a table."""
        data = self.load_data(table_name)
        if record_id in data:
            del data[record_id]
            self.save_data(table_name, data)
            logging.info(f"Record {record_id} deleted from {table_name}")
        else:
            logging.warning(f"Record {record_id} not found in {table_name}")
            
    def get_record(self, table_name: str, record_id: str) -> Optional[Dict]:
        """Get a specific record."""
        data = self.load_data(table_name)
        return data.get(record_id)
        
    def get_all_records(self, table_name: str) -> Dict:
        """Get all records from a table."""
        return self.load_data(table_name)
        
    def search_records(self, table_name: str, **criteria) -> Dict:
        """Search records based on criteria."""
        all_data = self.load_data(table_name)
        results = {}
        
        for record_id, record_data in all_data.items():
            match = True
            for key, value in criteria.items():
                if key not in record_data or record_data[key] != value:
                    match = False
                    break
            if match:
                results[record_id] = record_data
                
        return results

# Company constants
COMPANY_INFO = {
    'name': 'CONSTRUCTORA JORGE UBILLA RIVERA E.I.R.L.',
    'rut': '76.624.872-1',
    'address': 'LT 3 DEL LT A HJ 11, MAQUEHUA, CURICÓ, MAULE, CHILE',
    'phone': '+569 9299 4452',
    'email': 'CONSTRUCTORA@JURMAQ.CL'
}

FUEL_SUPPLIER = {
    'name': 'COMERCIAL MAQUEHUA SPA',
    'rut': '77.346.747-1'
}

def generate_id(prefix: str = "ID") -> str:
    """Generate a unique ID with timestamp."""
    return f"{prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]}"

def format_currency(amount: float) -> str:
    """Format amount as Chilean currency."""
    return f"${amount:,.0f}".replace(',', '.')

def validate_rut(rut: str) -> bool:
    """Validate Chilean RUT format."""
    # Basic validation - could be enhanced
    rut = rut.replace('.', '').replace('-', '')
    if len(rut) < 8 or len(rut) > 9:
        return False
    return True

def calculate_payroll(gross_salary: float, days_worked: int, total_days: int = 30) -> float:
    """Calculate final salary based on days worked."""
    return (gross_salary / total_days) * days_worked

# Initialize global database manager
db = DatabaseManager()