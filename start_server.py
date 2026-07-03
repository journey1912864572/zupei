from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Timer
import webbrowser


HOST = "127.0.0.1"
PORT = 5173
ROOT = Path(__file__).resolve().parent
URL = f"http://{HOST}:{PORT}/"


def main() -> None:
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    try:
        server = ThreadingHTTPServer((HOST, PORT), handler)
    except OSError as error:
        print(f"无法启动：{error}")
        print("如果提示端口已占用，请打开：http://127.0.0.1:5173/")
        input("按回车键关闭窗口……")
        return

    print("组织学与胚胎学题库已启动")
    print(f"访问地址：{URL}")
    print("使用期间请勿关闭此窗口。按 Ctrl+C 可停止服务。")
    Timer(1.0, lambda: webbrowser.open(URL)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
