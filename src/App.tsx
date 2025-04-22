import React, {useState, ChangeEvent, useRef} from 'react';

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
    pH: "Group | Sample | Time Point | Value",
    CFU: "Group | Sample | Time Point | Value",
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

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        setError('');
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleAskBE = async (chartType: string) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('analysis_type', selected);
        formData.append('chart_type', chartType);

        try {
            const res = await fetch('https://bacteria-server.onrender.com/analyze', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            setImageUrl(`https://bacteria-server.onrender.com${data.img}`);
        } catch {
            setError('ERROR: Maybe the file is wrong or data is missing?')
        }
    };

    const handleClean = () => {
        setFile(null);
        setImageUrl(null);
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    return (
        <div style={{padding: 20}}>
            <p style={{color: 'red'}}>{error}</p>
            <div style={{display: 'flex', marginBottom: 20, gap: 10, flexWrap: 'wrap'}}>
                {analysisTypes.map((type) => (
                    <button
                        key={type}
                        onClick={() => {
                            setSelected(type);
                            handleClean()
                        }}
                        style={{
                            backgroundColor: selected === type ? '#444' : '#eee',
                            color: selected === type ? '#fff' : '#000',
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                            cursor: 'pointer'
                        }}
                    >
                        {type}
                    </button>
                ))}
            </div>

            <h3>{selected}</h3>
            <p><strong>Expected format:</strong> {analysisFormats[selected]}</p>
            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChange} style={{display: 'none'}}/>

            <div style={{display: 'flex', alignItems: 'center', gridGap: '8px'}}>
                <button onClick={() => fileInputRef.current?.click()}>
                    Upload Excel File
                </button>
                {file && <div style={{display: 'flex', alignItems: 'center', gridGap: '8px'}}>
                    <p>File uploaded: {file.name}</p>
                    <p style={{color: 'red', cursor: 'pointer'}} onClick={handleClean}>X</p>
                </div>}
            </div>

            <div style={{marginTop: 10}}>
                {chartTypes[selected].map((chart) => (
                    <button key={chart} onClick={() => handleAskBE(chart)} style={{marginRight: 10}}>
                        {capitalizeFirstLetter(chart)}
                    </button>
                ))}
            </div>

            {imageUrl && (
                <div style={{marginTop: 30}}>
                    <img src={imageUrl} alt="Result" />
                </div>
            )}
        </div>
    );
}

const capitalizeFirstLetter = <T extends string>(string: T) => {
    return (string.charAt(0).toUpperCase() + string.slice(1)) as Capitalize<T>;
};

export default App;
