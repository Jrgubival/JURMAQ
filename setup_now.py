
import sys
from cx_Freeze import setup, Executable

base = "Win32GUI" if sys.platform == "win32" else None

setup(
    name="JURMAQ",
    version="1.0.0", 
    description="Sistema de Gestión",
    executables=[Executable("main.py", base=base, target_name="JURMAQ.exe")],
    options={
        "build_exe": {
            "packages": ["PyQt5.QtCore", "PyQt5.QtGui", "PyQt5.QtWidgets"],
            "include_msvcrt": True
        }
    }
)
