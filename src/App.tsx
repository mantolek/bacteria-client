import React, {useState, ChangeEvent, useRef} from 'react';
import * as XLSX from 'xlsx';

const analysisTypes = [
    'QLF', 'Hyperspectral', '16S', 'LFC', 'pH',
    'CFU', 'AlphaDiversity', 'BetaDiversity', 'LSMS',
    'Correlations', 'FluorescenceOverTime', 'ControlVsFn', 'SMDI'
];

const analysisFormats: Record<string, string> = {
    QLF: "Point | Group | R/G Value (Mean) | R/G Value (SD)",
    Hyperspectral: "Group | Wavelength | Time Point | Intensity",
    "16S": "Taxon Name | Ino | C_D3 | C_D9 | C_D15 | F_D3 | F_D9 | F_D15",
    LFC: "Taxon Name | Control_log2_d9/d3 | Control_log2_d15/d3 | Control_log2_d15/d9 | Fn_log2_d9/d3 | Fn_log2_d15/d3 | Fn_log2_d15/d9",
    pH: "Group | Sample | Time Point | Value | sd",
    CFU: "Group | Sample | Time Point | Value | sd",
    AlphaDiversity: "Sample | AlphaDiversity | Group",
    BetaDiversity: "Sample | Axis1 | Axis2 | Group",
    LSMS: "Compound | Sample_1 | Sample_2 | Sample_3 | Sample_4",
    Correlations: "Sample | Parameter_1 | Parameter_2",
    FluorescenceOverTime: "Wavelength (nm) | T0 | T1 | T2",
    ControlVsFn: "Wavelength (nm) | Sample_1 | Sample_2  (in two sheets: Control, Fn)",
    SMDI: "Sample | SMDI_Value | Group"
};

const chartTypes: Record<string, string[]> = {
    QLF: ['bar', 'heatmap'],
    Hyperspectral: ['lines'],
    "16S": ['bar', 'pie', 'heatmap'],
    LFC: ['bar', 'heatmap'],
    pH: ['boxplot', 'line'],
    CFU: ['line', 'bar'],
    AlphaDiversity: ['boxplot'],
    BetaDiversity: ['scatter'],
    LSMS: ['bar', 'pca'],
    Correlations: ['scatter_reg'],
    FluorescenceOverTime: ['line', 'surface'],
    ControlVsFn: ['grouped_bar', 'violin'],
    SMDI: ['boxplot', 'bar']
};

function App() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selected, setSelected] = useState(analysisTypes[0]);
    const [file, setFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [groups, setGroups] = useState<string[]>([]);
    const [colors, setColors] = useState<Record<string, string>>({});

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        setError('');
        if (e.target.files && e.target.files[0]) {
            const uploadedFile = e.target.files[0];
            setFile(uploadedFile);
            await extractGroups(uploadedFile);
        }
    };

    const extractGroups = async (file: File) => {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        if (jsonData.length === 0) {
            setGroups([]);
            return;
        }

        const firstRow = jsonData[0];
        const availableColumns = Object.keys(firstRow);
        const normalizedColumns = availableColumns.map(col => col.toLowerCase());

        const groupCandidates = ['group', 'taxon name', 'wavelength (nm)', 'wavelength', 'compound', 'sample'];

        let selectedColumn = availableColumns.find((col, idx) => groupCandidates.includes(normalizedColumns[idx]));

        if (!selectedColumn) {
            selectedColumn = availableColumns[0];
        }

        let uniqueOptions: string[] = [];

        if (selected === 'ControlVsFn' || selected === 'AlphaDiversity' || selected === 'BetaDiversity' || selected === 'SMDI') {
            uniqueOptions = ['Control', 'Fn'];
        } else if (selected === 'Correlations'){
            uniqueOptions = ['scatter', 'line']
        } else {
            uniqueOptions = Array.from(
                new Set(jsonData.map(row => row[selectedColumn as keyof typeof row]).filter(Boolean))
            );
        }

        setGroups(uniqueOptions);

        const initialColors: Record<string, string> = {};
        uniqueOptions.forEach(option => {
            initialColors[option] = '#000000';
        });
        setColors(initialColors);
    };


    const handleColorChange = (group: string, color: string) => {
        setColors(prev => ({
            ...prev,
            [group]: color
        }));
    };

    const handleCreateChart = async (chartType: string) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('analysis_type', selected);
        formData.append('chart_type', chartType);
        formData.append('colors', JSON.stringify(colors));

        try {
            const res = await fetch('https://bacteria-server.onrender.com/analyze', {
            // const res = await fetch('http://localhost:5050/analyze', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }

            const data = await res.json();
            setImageUrl(`https://bacteria-server.onrender.com${data.img}?t=${Date.now()}`);
            // setImageUrl(`http://localhost:5050/${data.img}?t=${Date.now()}`);
            setError('');
        } catch {
            setError('ERROR: Maybe the file is wrong or data is missing?')
        }
    };

    const handleClean = () => {
        setFile(null);
        setImageUrl(null);
        setError('');
        setGroups([])
        setColors({})
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    const handleDownload = () => {
        if (!imageUrl) return;
        fetch(imageUrl)
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = 'chart.svg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch(error => {
                console.error('Error downloading the SVG:', error);
            });
    };

    return (
        <div className="Container">
            {error && <p className="Error">{error}</p>}
            <div className="Buttons">
                {analysisTypes.map((type) => (
                    <button
                        key={type}
                        onClick={() => {
                            setSelected(type);
                            handleClean()
                        }}
                        className={`Button ${selected === type ? 'Button--selected' : ''}`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            <div className="Title">
                <h3>{selected}</h3>
                <p><strong>Expected format:</strong> {analysisFormats[selected]}</p>
            </div>

            <div className="Action">
                <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChange}
                       style={{display: 'none'}}/>

                <div className="Upload">
                    <button onClick={() => fileInputRef.current?.click()}
                            className={`Button ${file ? 'Button--selected' : ''}`}>
                        Upload Excel File
                    </button>
                    {file && <div className="Upload__text">
                        <p>File uploaded: {file.name}</p>
                        <p style={{color: 'red', cursor: 'pointer'}} onClick={handleClean}>X</p>
                    </div>}
                </div>

                {file && <div className="ChartType">
                    {chartTypes[selected].map((chart) => (
                        <button className="ChartType__button" key={chart} onClick={() => handleCreateChart(chart)}>
                            {capitalizeFirstLetter(chart)}
                        </button>
                    ))}
                </div>}

                {file && groups.length > 0 && (
                    <div className="ColorPicker">
                        {groups.map(group => (
                            <div key={group} style={{marginBottom: '10px'}}>
                                <span>{group}</span>
                                <input
                                    type="color"
                                    value={colors[group] || '#000000'}
                                    onChange={(e) => handleColorChange(group, e.target.value)}
                                    style={{marginLeft: '10px'}}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {imageUrl && <div>
                    <button onClick={handleDownload} className="Button">Download</button>
                </div>}
            </div>


            {imageUrl && (
                <div className="Result">
                    <img src={imageUrl} alt="Result"/>
                </div>
            )}
        </div>
    );
}

const capitalizeFirstLetter = <T extends string>(string: T) => {
    return (string.charAt(0).toUpperCase() + string.slice(1)) as Capitalize<T>;
};

export default App;
