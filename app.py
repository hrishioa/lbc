from flask import Flask, current_app, jsonify, request
from numpy import array
import LBC

app = Flask(__name__)

@app.route('/synthetic_data', methods=['POST'])
def synthetic_data():
    argument_headers = ["lower_l", "upper_l", "no_dp", "c0", "k", "a", "sigma"]
    argument_not_float = ["no_dp", "a"]
    arguments = {}
    data_params = request.get_json()
    for header in argument_headers:
        if header not in data_params:
            return jsonify({"success":False, "message": "Missing parameter %s" % header})
        arguments[header] = data_params[header] if header in argument_not_float else float(data_params[header]) 

    print("Arguments - %s" % arguments)

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

    print("Arguments - %s" % arguments)

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
    # Threaded option to enable multiple instances for multiple user access support
    app.run(threaded=True, port=5000)