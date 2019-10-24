//######################## CONSTANTS ############################################
let color;
let chartInputDataset, chartCorrectedData, chartSelectedBaseline, chartLogisticBaselineFit, chartExtractedBaseline;
let outputTable, inputTable, inputExportPlugin, outputExportPlugin;
let outputTableContainer = document.getElementById('outputSpreadsheet');
let inputTableContainer = document.getElementById('inputSpreadsheet');
let inputData = [['','']];
let outputData = [];
let dataset = {
    loaded: false,
    ready: false,
    input: [],
    syntheticParameters: {},
    LBCParameters: {}
};
let inputCtx = document.getElementById('inputChart').getContext('2d');
let outputCtx = document.getElementById('outputChart').getContext('2d');

//############################# FUNCTIONS #####################################
function dataFilled() {
    if(inputData.length && inputData[0].length) {
        let parsed = parseInputData();
        if(parsed.filter(insides => insides.filter(isNaN).length > 0).length === 0)
        return true;
    }
    return false;
}

function getLibraryLoader(id) {
    return () => {
        toastr.info("Loading dataset..");

        $.ajax({
            url: '/load_from_library',
            type: 'POST',
            data: JSON.stringify({id: id}),
            contentType: "application/json",
            dataType: "json",
            failure: (errMsg) => toastr.error(`Error loading dataset - ${errMsg}`),
            success: (data) => {
                if(!data.success)
                    return toastr.error(`Error loading dataset - ${data.message}`);

                dataSet = JSON.parse(data.data.data);
                for(let param in dataSet.LBCParameters) {
                    $(`#${param}`).val(dataSet.LBCParameters[param])
                }
                for(let param in dataSet.syntheticParameters) {
                    if(param === 'a')
                        $(`#${param}`).val(JSON.stringify(dataSet.syntheticParameters[param]))    
                    else
                        $(`#${param}`).val(dataSet.syntheticParameters[param])
                }

                inputData = dataSet.input;
                inputTable.loadData(inputData);

                toastr.success("Loaded dataset");

                getLBC();
            }
        })
    };
}

function loadLibrary() {
    toastr.info("Loading library...");

    $.ajax({
        url: '/get_library',
        type: 'POST',
        data: {},
        failure: (errMsg) => toastr.error(`Error loading library - ${errMsg}`),
        success: (data) => {
            if(!data.success)
                return toastr.error(`Error loading library - ${data.message}`);
            $('#libraryTable tbody').html("");            
            if(data.data && data.data.length > 0) {
                data.data.map(row => {
                    $('#libraryTable tbody').append(
                        $('<tr>')
                            .append($('<td>').text(row.name))
                            .append($('<td>').text(row.owner))
                            .append($('<td>').text(row.type))
                            .append($('<td>').text(row.loads))
                            .append($('<td>').text(row.created))
                            .append($('<td>').append($('<button>').text('View').click(getLibraryLoader(row.id)))));
                })
            }

            toastr.success("Library loaded.")
        }
    })
}

function parseInputData() {
    // Jesus fuck localization
    return inputData.map(insides=>insides.map(val => parseFloat(val.toString().replace(/,([^,]*)$/, ".$1"))))            
}

function plotInputData(silent=true) {
    if(!dataFilled()) {
        if(silent)
            return;
        else
            return toastr.error("Input data is empty or invalid");
    }
    
    chartInputDataset.data = parseInputData().map(row => ({x:row[0],y:row[1]}));
    window.inputChart.update();     
}

function saveBase64AsFile(base64, fileName) {
    var link = document.createElement("a");

    link.setAttribute("href", base64);
    link.setAttribute("download", fileName);
    link.click();
}

function getLBC() {
    if(!dataFilled())
        return toastr.error("Data invalid or empty");
    $.ajax({
        type: 'POST',
        url: '/lbc',
        data: JSON.stringify({
            data: parseInputData(),
            start: parseFloat($('#start').val()), 
            end: parseFloat($('#end').val()), 
            order_poly: parseInt($('#order_poly').val()), 
            pre_weight_factor: parseFloat($('#pre_weight_factor').val()),
            post_weight_factor: parseFloat($('#post_weight_factor').val()),
        }),
        contentType: 'application/json',
        dataType: 'json',
        failure: (errMsg) => toastr.error(`Error computing LBC - ${errMsg}`),
        success: (data) => {
            if(!data.success)
                return toastr.error(`Error computing LBC - ${data.message}`);
            
            $('#signal_magnitude').html(`Signal Magnitude: ${data["signal_magnitude"]}`);
            chartCorrectedData.data = data.corrected.map(row => ({x:row[0],y:row[1]}));
            chartSelectedBaseline.data = data["input_baseline"].map(row => ({x:row[0],y:row[1]}));
            chartLogisticBaselineFit.data = data["baseline_step_fit"].map(row => ({x:row[0],y:row[1]}));
            chartExtractedBaseline.data = data["extracted_baseline"].map(row => ({x:row[0],y:row[1]}));
            window.inputChart.update();
            window.outputChart.update();
            
            outputData = [];
            inputData.forEach((element, index) => {
                outputData.push([
                    inputData[index][0],
                    inputData[index][1],
                    data["corrected"][index][1],
                    data["baseline_step_fit"][index][1],
                    data["extracted_baseline"][index][1]
                ])
            });
            outputTable.loadData(outputData);

            toastr.success("LBC Complete");
        }
    })
}

function markDatasetReady() {
    dataset.input = inputData;
    dataset.syntheticParameters = {
        "lower_l": $('#lower_l').val(),
        "upper_l": $('#upper_l').val(),
        "no_dp": $('#no_dp').val(),
        "c0": $('#c0').val(),
        "k": $('#k').val(),
        "a": JSON.parse($('#a').val()),
        "sigma": $('#sigma').val(),
    };
    dataset.LBCParameters = {
        start: $('#start').val(), 
        end: $('#end').val(), 
        order_poly: $('#order_poly').val(), 
        pre_weight_factor: $('#pre_weight_factor').val(),
        post_weight_factor: $('#post_weight_factor').val()
    }
    dataset.ready = true;
}

function initializeElements() {
    window.chartColors = {
        red: 'rgba(255, 99, 132, 0.5)',
        orange: 'rgb(255, 159, 64)',
        yellow: 'rgb(255, 205, 86)',
        green: 'rgb(75, 192, 192)',
        blue: 'rgb(54, 162, 235)',
        purple: 'rgb(153, 102, 255)',
        grey: 'rgb(201, 203, 207)'
    };
    color = Chart.helpers.color;
    
    toastr.options = {
        "closeButton": true,
        "debug": false,
        "newestOnTop": true,
        "progressBar": true,
        "positionClass": "toast-top-right",
        "preventDuplicates": true,
        "onclick": null,
        "showDuration": "300",
        "hideDuration": "1000",
        "timeOut": "4000",
        "extendedTimeOut": "1000",
        "showEasing": "swing",
        "hideEasing": "linear",
        "showMethod": "fadeIn",
        "hideMethod": "fadeOut"
    }

    chartInputDataset = {
        label: 'Data',
        borderColor: window.chartColors.red,
        backgroundColor: color(window.chartColors.red).alpha(0.2).rgbString(),
        data: []
    };
    chartCorrectedData = {
        label: 'Corrected Data',
        borderColor: window.chartColors.blue,
        backgroundColor: color(window.chartColors.blue).alpha(0.2).rgbString(),
        data: []
    };
    chartSelectedBaseline = {
        label: 'Selected Baseline Data Points',
        borderColor: window.chartColors.green,
        backgroundColor: color(window.chartColors.green).alpha(0.2).rgbString(),
        data: [],
        radius: 5,
        // pointStyle: 'cross',
        borderWidth: 2
    };
    chartLogisticBaselineFit = {
        label: 'Logistic Baseline Fit',
        borderColor: window.chartColors.orange,
        backgroundColor: color(window.chartColors.orange).alpha(0.2).rgbString(),
        data: [],
        type: 'line',
        fill: false,
        pointRadius: 0
    };
    chartExtractedBaseline = {            
        label: 'Extracted Baseline Function',
        borderColor: window.chartColors.purple,
        backgroundColor: color(window.chartColors.purple).alpha(0.2).rgbString(),
        data: [],
        type: 'line',
        fill: false,
        pointRadius: 0
    };
    
    outputTable = new Handsontable(outputTableContainer, {
        data: outputData,
        height: 250,
        colHeaders: ['X', 'Y', 'Corrected Y', 'Logistic Baseline Fit', 'Extracted Baseline Function'],
        readOnly: true,
        contextMenu: true,
        allowEmpty: false,
        filters: true,
        dropdownMenu: false,
        licenseKey: 'non-commercial-and-evaluation',
    });
    
    inputTable = new Handsontable(inputTableContainer, {
        data: inputData,
        height: 250,
        editor: false,
        contextMenu: true,
        colHeaders: ['X', 'Y'],
        allowEmpty: false,
        filters: true,
        dropdownMenu: true,
        licenseKey: 'non-commercial-and-evaluation',
        afterChange: (changes) => {
            plotInputData(silent=true)
        }
    });
    
    inputExportPlugin = inputTable.getPlugin('exportFile');
    outputExportPlugin = outputTable.getPlugin('exportFile');
    
    window.inputChart = new Chart(inputCtx, {
        type: 'bubble',
        data: {
            datasets: [
                chartInputDataset,
                chartSelectedBaseline,
                chartLogisticBaselineFit,
                chartExtractedBaseline,
            ]
        },
        options: {
            tooltips: {
                callbacks: {
                    label: (tooltipItem) => {
                        return `${tooltipItem.xLabel}, ${tooltipItem.yLabel}`;
                    }
                }
            },
            maintainAspectRatio: false,
            title: {
                display: true,
                text: 'Ingress and fit'
            },
            plugins: {
                zoom: {
                    zoom: {
                        enabled: true,
                        drag: true,
                        mode: 'xy',
                        rangeMin: {
                            x: null,
                            y: null
                        },
                        rangeMax: {
                            x: null,
                            y: null
                        },
                        speed: 0.1,
                    }
                }
            }
        },
    });   
    
    window.outputChart = new Chart(outputCtx, {
        type: 'bubble',
        data: {
            datasets: [
                chartCorrectedData,
            ]
        },
        options: {
            tooltips: {
                callbacks: {
                    label: (tooltipItem) => {
                        return `${tooltipItem.xLabel}, ${tooltipItem.yLabel}`;
                    }
                }
            },
            maintainAspectRatio: false,
            title: {
                display: true,
                text: 'Corrected'
            },
            plugins: {
                zoom: {
                    zoom: {
                        enabled: true,
                        drag: true,
                        mode: 'xy',
                        rangeMin: {
                            x: null,
                            y: null
                        },
                        rangeMax: {
                            x: null,
                            y: null
                        },
                        speed: 0.1,
                    }
                }
            }
        },
    });             
}

//############################ HANDLERS #################################

function setHandlers() {
    $('#loadFile').click(() => {
        let formData = new FormData();
        let inputFile = $('#input_file')[0].files[0];
        formData.append('input_file', inputFile);            
        
        $.ajax({
            url: '/loadfile',
            type: 'POST',
            data: formData,
            contentType: false,
            processData: false,
            failure: (errMsg) => toastr.error(`Error loading file - ${errMsg}`),
            success: (data) => {
                if(data.success) {
                    inputData = data.data;
                    inputTable.loadData(inputData);
                    toastr.success('Data successfully loaded')
                } else {
                    toastr.error(`Error loading file - ${data.message}`);
                }
            }
        })
    });

    $('#saveToLibrary').click(() => {
        if(!dataset.ready)
            return toastr.error("Please run a successful Baseline Correction to save.");
        // TODO: Add input validation since this goes into a database

        $.ajax({
            url: '/save_to_library',
            type: 'POST',
            data: JSON.stringify({
                name: $('#libraryTitle').val(),
                owner: $('#libraryOwner').val(),
                type: $('#libraryType').val(),
                data: dataset    
            }),
            contentType: 'application/json',
            dataType: 'json',
            failure: (errMsg) => toastr.error(`Error saving to library - ${errMsg}`),
            success: (data) => {
                if(!data.success)
                    return toastr.error(`Error saving to library - ${data.message}`);
                toastr.success("Saved successfully");
                loadLibrary();
            }
        })
    });
    
    $('#downloadChart').click(() => {
        let inputChartBase64 = window.inputChart.toBase64Image();
        let outputChartBase64 = window.outputChart.toBase64Image();
        
        saveBase64AsFile(inputChartBase64, `LBC-in-${new Date()}.png`);
        saveBase64AsFile(outputChartBase64, `LBC-out-${new Date()}.png`);
    });
    
    $('#resetZoom').click(() => {
        window.inputChart.resetZoom();
        window.outputChart.resetZoom();
    })
    
    $('#plotData').click(() => {
        plotInputData(silent=false);
    })
    
    $('#clearInputData').click(() => {
        inputData = [['','']];
        inputTable.loadData(inputData);
    })
    
    $('#exportInputData').click(() => {
        if(!dataFilled())
            return toastr.error("Data invalid or empty");
        inputExportPlugin.downloadFile('csv', {
            bom: false,  
            columnDelimiter: ',',
            columnHeaders: true,
            rowHeaders: false,
            exportHiddenColumns: true,
            exportHiddenRows: true,
            fileExtension: 'csv',
            filename: `LBC-input-CSV-[YYYY]-[MM]-[DD]`,
            mimeType: 'text/csv',
            rowDelimiter: '\r\n',
        });
    })
    
    $('#exportOutputData').click(() => {
        if(outputData.length <= 0)
            return toastr.error("Data invalid or empty");
        outputExportPlugin.downloadFile('csv', {
            bom: false,  
            columnDelimiter: ',',
            columnHeaders: true,
            rowHeaders: false,
            exportHiddenColumns: true,
            exportHiddenRows: true,
            fileExtension: 'csv',
            filename: `LBC-output-CSV-[YYYY]-[MM]-[DD]`,
            mimeType: 'text/csv',
            rowDelimiter: '\r\n',
        });
    })
    
    $('#getLBC').click(() => {
        getLBC();
        markDatasetReady();
    });
    
    $('#genSynthetic').click(() => {
        $.ajax({
            type: 'POST',
            url: '/synthetic_data',
            data: JSON.stringify({
                lower_l : parseFloat($('#lower_l').val()), 
                upper_l : parseFloat($('#upper_l').val()), 
                no_dp : parseInt($('#no_dp').val()), 
                c0 : parseFloat($('#c0').val()), 
                k : parseFloat($('#k').val()), 
                a : JSON.parse($('#a').val()), 
                sigma : parseFloat($('#sigma').val())                
            }),
            contentType: "application/json",
            dataType: "json",
            failure: (errMsg) => toastr.error(`Error generating data - ${errMsg}`),
            success: (data) => {
                if(data.success) {
                    inputData = data.data
                    inputTable.loadData(inputData);                       
                    toastr.success('Synthetic data generated')
                } else {
                    toastr.error(`Error generating synthetic data - ${data.message}`);
                }
            }            
        })
    })
}    

//########################### LOADING ###############################
$(window).on('load', () => {
    initializeElements();
    setHandlers();
    loadLibrary();
})