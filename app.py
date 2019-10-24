from flask import Flask, current_app, jsonify, request
from numpy import array, float64
import LBC
from werkzeug.utils import secure_filename
import os
import pandas as pd
from sqlalchemy.sql import func
from sqlalchemy import create_engine, select
from sqlalchemy import Table, Column, String, Integer, MetaData, DateTime
import json
import datetime
import logging

UPLOAD_FOLDER = './'
LIBRARY_TABLENAME = 'library'

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'tsv']
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_extension(filename):
    return filename.rsplit('.', 1)[1].lower()

def get_library_table():
    if(os.environ.get('DATABASE_URL') == None):
        return print("No database url found in get library table")
    db = create_engine(os.environ.get('DATABASE_URL'), pool_size=2, max_overflow=2)
    library_table = None
    metadata = MetaData(db)
    conn = db.connect()
    if not db.dialect.has_table(db, LIBRARY_TABLENAME):
        print("Table doesn't exist")
        library_table = Table(LIBRARY_TABLENAME, metadata,
            Column('id', Integer, primary_key=True, autoincrement=True),
            Column('name', String, nullable=False),
            Column('owner', String, nullable=False),
            Column('type', String, nullable=False),
            Column('loads', Integer, default=0),
            Column('liked', Integer, default=0),
            Column('created', DateTime, server_default=func.now()),
            Column('last_modified', DateTime, server_default=func.now(), onupdate=func.now()),
            Column('data', String))
        library_table.create()
        print("Table created")
    else:
        library_table = Table(LIBRARY_TABLENAME, metadata, autoload=True, autoload_with=db)
        print("Table exists")
    return library_table, conn

@app.route('/save_to_library', methods=['POST'])
def save_dataset():
    try:
        data_params = request.get_json()
        # TODO: Check that all the values are there

        library, conn = get_library_table()
        insert_statement = library.insert().values(
            name=data_params["name"], 
            owner=data_params["owner"],
            type=data_params["type"],
            loads=0,
            liked=0,
            data=json.dumps(data_params["data"]))
        conn.execute(insert_statement)
        
        return jsonify({
            "success": True,
            "message": "Testing"
        })
    except Exception as e:
        logging.exception("Error in save_to_library")
        return jsonify({
            "success": False,
            "message": "Invalid metadata, could not save"
        })
    finally:
        ## This is super hacky but so is python when it comes to this and I refuse to have a try block in here of all places
        ## Jesus screw python
        try:
            conn.close()
            print("Closed connection")
        except:
            pass

@app.route('/load_from_library', methods=['POST'])
def load_dataset():
    try:
        data_params = request.get_json()
        if 'id' not in data_params:
            return jsonify({
                "success": False,
                "message": "Required parameter id is missing"
            })

        library, conn = get_library_table()
        rowProxy = conn.execute(select([library.columns.name, library.columns.data, library.columns.id, library.columns.owner, library.columns.type]).where(library.columns.id==data_params["id"]).limit(1))    

        if rowProxy.rowcount <= 0:
            return jsonify({
                "success": False,
                "message": "Dataset does not exist"
            })

        return jsonify({
            "success": True,
            "data": dict(rowProxy.fetchone())
        })
    except Exception as e:
        logging.exception("Error in load_from_library - %s" % e)
        return jsonify({
            "success": False,
            "message": "Could not retrieve dataset"
        })
    finally:
        try:
            conn.close()
            print("Closed connection")
        except:
            pass

@app.route('/get_library', methods=['POST'])
def get_library():
    try:
        library, conn = get_library_table()
        rowProxy = conn.execute(select([library.columns.name, library.columns.id, library.columns.loads, library.columns.owner, library.columns.type, library.columns.created]))
        rows = []
        for row in rowProxy:
            rows.append(dict(row))

        return jsonify({
            "success": True,
            "data": rows
        })
    except:
        logging.exception("Error in get_library")
        return jsonify({
            "success": False,
            "message": "Library fetching failed"
        })
    finally:
        try:
            conn.close()
            print("Closed connection")
        except:
            pass

@app.route('/loadfile', methods=['POST'])
def upload_file():
    try:
        # check if the post request has the file part
        if 'input_file' not in request.files:
            return jsonify({
                "success": False,
                "message": "Input file missing"
            })
        file = request.files['input_file']
        if file.filename == '':
            return jsonify({
                "success": False,
                "message": "Input file missing"
            })
        if (not file) or (not allowed_file(file.filename)):
            return jsonify({
                "success": False,
                "message": "Invalid file"
            })
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Process the file
        extension = get_file_extension(filename)
        loaded = None
        error_message = None
        if extension == "csv" or extension == "tsv":
            try:
                loaded = pd.read_csv(filepath, header=None).to_numpy().astype(float64)
            except:
                # Try it without headers
                try:
                    loaded = pd.read_csv(filepath).to_numpy().astype(float64)
                except:
                    error_message = "csv is invalid or not fully numeric"
        elif extension == "xlsx" or extension == "xls":
            try:
                loaded = pd.read_excel(filepath, header=None).to_numpy().astype(float64)
            except Exception as e:
                # Try it without headers
                try:
                    loaded = pd.read_excel(filepath).to_numpy().astype(float64)
                except Exception as e2:
                    error_message = "Excel file is invalid or not fully numeric"

        if os.path.exists(filepath):
            os.remove(filepath)

        if loaded is None:
            return jsonify({
                "success": False,
                "message": error_message if error_message != None else "Could not read file"
            })
        else:
            return jsonify({
                "success": True,
                "message": "File loaded",
                "data": loaded.tolist()
            })
    except Exception as e:
        logging.exception("Error in loadfile")
        return jsonify({
            "success": False,
            "message": "Error processing file"
        })

@app.route('/synthetic_data', methods=['POST'])
def synthetic_data():
    try:
        argument_headers = ["lower_l", "upper_l", "no_dp", "c0", "k", "a", "sigma"]
        argument_not_float = ["no_dp", "a"]
        arguments = {}
        data_params = request.get_json()
        for header in argument_headers:
            if header not in data_params:
                return jsonify({"success":False, "message":  "Missing parameter %s" % header})
            arguments[header] = data_params[header] if header in argument_not_float else float(data_params[header]) 

        data = LBC.synthetic_data(**arguments)
        return jsonify({"success":True, "data": data.tolist()})
    except Exception as e:
        logging.exception("Error in synthetic_data")
        return jsonify({
            "success": False,
            "message": "Invalid parameters for data generation"
        })

@app.route('/lbc', methods=['POST'])
def lbc():
    try:
        argument_headers = ["data", "start", "end", "order_poly", "pre_weight_factor", "post_weight_factor"]
        argument_not_float = ["order_poly"]
        argument_optional = ["pre_weight_factor", "post_weight_factor"]
        input_data = request.get_json()
        arguments = {}
        for header in argument_headers:
            if header in input_data:
                if header == "data":
                    arguments[header] = array(input_data[header])
                elif header in argument_not_float:
                    arguments[header] = input_data[header]
                else:
                    arguments[header] = float(input_data[header])
            elif not header in argument_optional:
                return jsonify({"success": False, "message": "Required parameter %s missing." % header}) 

        result = LBC.elevator_function_fitting(**arguments)

        return jsonify({
            "success": True, 
            "corrected": result["corrected"].tolist(),
            "input_baseline": result["input_baseline"].tolist(),
            "baseline_step_fit": result["baseline_step_fit"].tolist(),
            "extracted_baseline": result["extracted_baseline"].tolist(),
            "signal_magnitude": -result["signal_magnitude"]
        })
    except Exception as e:
        logging.exception("Error in lbc")
        return jsonify({
            "success": False,
            "message": "Invalid parameters for LBC"
        })

@app.route('/')
def index():
    return current_app.send_static_file('index.html')

@app.route('/index2')
def index2():
    return current_app.send_static_file('index2.html')

@app.route('/index.js')
def send_js():
    return current_app.send_static_file('index.js')

if __name__ == '__main__':
    app.run(threaded=True, port=5000)