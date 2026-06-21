# -*- coding: utf-8 -*-
from api.index import app

if __name__ == "__main__":
    print("✨ iTunes + YouTube Super Deus Supremo")
    print("🌐 Abre: http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
