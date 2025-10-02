# I dont know why your here in this dir, but just know the docker-compose in the root dir should properly build for you everything

## senkloud-backend
- setup a python virtual environment
```python
python -m venv senkloud-backend
```

- remember to setup the whole backend dir into a virtual environment

- install the dependencies
```
pip install -r requirements.txt
```

- start the server
```
python app.py
```


# NB: only use this for development purposes, use the docker build for deployment