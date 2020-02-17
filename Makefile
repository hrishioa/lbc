SHELL := /bin/bash
run:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	python3 -m flask run --host 0.0.0.0 --port 5000

wsgi:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	uwsgi --http :80 --wsgi-file app.py --callable app --processes 4 --threads 2

dbtunnel:
	ssh -NL 2222:localhost:5432 root@zork

repl:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	python3
