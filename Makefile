SHELL := /bin/bash
run:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	python3 -m flask run --host 0.0.0.0 --port 5000

wsgi:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	uwsgi --http :5000 --wsgi-file app.py --callable app --processes 4 --threads 2

wsgi_nginx:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	uwsgi --socket 127.0.0.1:8080 --wsgi-file app.py --callable app --processes 4 --threads 2

dbtunnel:
	ssh -NL 2222:localhost:5432 root@zork

repl:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	python3
