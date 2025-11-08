from fastapi import FastAPI
import uvicorn
from config.settings import settings

app = FastAPI()


@app.get('/')
def check():
    return "Ok"


if __name__ == '__main__':
    uvicorn.run("main:app", host='0.0.0.0', port=8000, reload=True)

