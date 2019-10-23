from flask import Flask, current_app, jsonify, request
from numpy import array, float64
import LBC
from werkzeug.utils import secure_filename
import os
import pandas as pd

UPLOAD_FOLDER = './'

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'tsv']
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_extension(filename):
    return filename.rsplit('.', 1)[1].lower()

@app.route('/load', methods=['POST'])
def upload_file():
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

@app.route('/synthetic_data', methods=['POST'])
def synthetic_data():
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

@app.route('/lbc', methods=['POST'])
def lbc():
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

@app.route('/')
def index():
    return current_app.send_static_file('index.html')

if __name__ == '__main__':
    app.run(threaded=True, port=5000)