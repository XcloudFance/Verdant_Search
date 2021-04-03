from backend import *

if __name__ == '__main__':
    Get_Config()
    postgresql_initation()
    http_server = WSGIServer(("0.0.0.0", 8888), app)
    http_server.serve_forever()