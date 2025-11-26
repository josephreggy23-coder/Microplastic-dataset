const { useState } = React;
const { Download, Play, AlertCircle, CheckCircle } = lucide;

const MicroplasticDatasetGenerator = () => {
  const [generating, setGenerating] = useState(false);
  const [dataset, setDataset] = useState(null);
  const [filtrationDataset, setFiltrationDataset] = useState(null);
  const [progress, setProgress] = useState(0);

  // Polymer properties based on literature
  const polymerProperties = {
    PE: {
      quantumYield: 0.38,
      bindingEfficiency: 0.85,
      baselineFluorescence: 1200,
      sizeCoefficient: 1.0
    },
    PP: {
      quantumYield: 0.35,
      bindingEfficiency: 0.80,
      baselineFluorescence: 1100,
      sizeCoefficient: 0.95
    },
    PS: {
      quantumYield: 0.42,
      bindingEfficiency: 0.90,
      baselineFluorescence: 1400,
      sizeCoefficient: 1.05
    },
    PET: {
      quantumYield: 0.33,
      bindingEfficiency: 0.75,
      baselineFluorescence: 1000,
      sizeCoefficient: 0.90
    }
  };

  // Photodiode parameters
  const responsivity = 0.4; // A/W
  const darkCurrent = 2e-9; // A
  const transimpedanceGain = 1e6; // Ω
  const adcBits = 12;
  const adcVoltageRange = 5.0;

  // Generate log-normal distributed particle sizes
  const generateParticleSizes = (n, mean = 500, std = 200) => {
    const sizes = [];
    const mu = Math.log(mean);
    const sigma = 0.6;
    
    for (let i = 0; i < n; i++) {
      let u1 = Math.random();
      let u2 = Math.random();
      let z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      let size = Math.exp(mu + sigma * z);
      size = Math.max(5, Math.min(5000, size));
      sizes.push(size);
    }
    return sizes;
  };

  // Calculate fluorescence signal
  const calculateFluorescence = (sizes, polymerType, nileRedConc, excitationWl) => {
    const props = polymerProperties[polymerType];
    
    // Nile Red concentration effect (saturation curve)
    const concFactor = nileRedConc / (nileRedConc + 2.0);
    
    // Excitation wavelength efficiency (peak at 550 nm)
    const wlFactor = Math.exp(-Math.pow(excitationWl - 550, 2) / (2 * 40 * 40));
    
    let totalSignal = 0;
    sizes.forEach(size => {
      // Surface area scaling
      const relativeIntensity = Math.pow(size / 500, 2) * (0.85 + Math.random() * 0.3);
      
      // Calculate photocurrent
      const photocurrent = props.baselineFluorescence * props.quantumYield * 
                          props.bindingEfficiency * relativeIntensity * 
                          concFactor * wlFactor * responsivity * 1e-9;
      
      // Convert to voltage
      const voltage = photocurrent * transimpedanceGain;
      totalSignal += voltage;
    });
    
    return totalSignal;
  };

  // Add realistic noise
  const addNoise = (signal) => {
    const shotNoise = (Math.random() - 0.5) * 0.002 * Math.sqrt(Math.abs(signal));
    const darkNoise = (Math.random() - 0.5) * darkCurrent * transimpedanceGain * 0.2;
    const johnsonNoise = (Math.random() - 0.5) * 0.002;
    const flickerNoise = (Math.random() - 0.5) * 0.001;
    
    return signal + shotNoise + darkNoise + johnsonNoise + flickerNoise;
  };

  // Digitize signal
  const digitizeSignal = (analogVoltage) => {
    const clipped = Math.max(0, Math.min(adcVoltageRange, analogVoltage));
    const maxCount = Math.pow(2, adcBits) - 1;
    return Math.round((clipped / adcVoltageRange) * maxCount);
  };

  // Generate single measurement
  const generateMeasurement = (nParticles, polymerType, nileRedConc, excitationWl) => {
    const sizes = generateParticleSizes(nParticles);
    const meanSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const stdSize = Math.sqrt(sizes.reduce((sq, n) => sq + Math.pow(n - meanSize, 2), 0) / sizes.length);
    
    // Background from organic matter
    const background = Math.random() * 0.1 + 0.05;
    
    const totalSignal = calculateFluorescence(sizes, polymerType, nileRedConc, excitationWl);
    const totalAnalog = totalSignal + background;
    const noisySignal = addNoise(totalAnalog);
    const digitalCounts = digitizeSignal(noisySignal);
    
    return {
      meanSize,
      stdSize,
      totalAnalog,
      noisySignal,
      digitalCounts,
      background,
      signalToNoise: totalAnalog / 0.005
    };
  };

  // Generate full dataset
  const generateDataset = async () => {
    setGenerating(true);
    setProgress(0);
    
    const mainData = [];
    const polymers = ['PE', 'PP', 'PS', 'PET'];
    const particleCounts = [10, 25, 50, 100, 250, 500, 1000];
    const nileRedConcs = [0.5, 1.0, 5.0, 10.0];
    const excitationWls = [450, 488, 520];
    const replicates = 3;
    
    let sampleId = 0;
    const totalSamples = polymers.length * particleCounts.length * nileRedConcs.length * 
                        excitationWls.length * replicates;
    
    for (const polymer of polymers) {
      for (const particleCount of particleCounts) {
        for (const nrConc of nileRedConcs) {
          for (const exWl of excitationWls) {
            for (let rep = 0; rep < replicates; rep++) {
              const measurement = generateMeasurement(particleCount, polymer, nrConc, exWl);
              
              mainData.push({
                sample_id: sampleId++,
                polymer_type: polymer,
                particle_count: particleCount,
                nile_red_conc_ugmL: nrConc,
                excitation_nm: exWl,
                replicate: rep + 1,
                mean_particle_size_um: measurement.meanSize.toFixed(2),
                std_particle_size_um: measurement.stdSize.toFixed(2),
                total_analog_voltage: measurement.totalAnalog.toFixed(6),
                noisy_analog_voltage: measurement.noisySignal.toFixed(6),
                digital_counts: measurement.digitalCounts,
                background_voltage: measurement.background.toFixed(6),
                signal_to_noise_ratio: measurement.signalToNoise.toFixed(2)
              });
              
              setProgress(Math.round((sampleId / totalSamples) * 50));
              
              // Allow UI to update
              if (sampleId % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            }
          }
        }
      }
    }
    
    setDataset(mainData);
    
    // Generate filtration dataset
    const filtrationData = [];
    let filtrationId = 0;
    const initialCounts = [100, 500, 1000, 5000];
    const filterEfficiency = 0.95;
    
    for (const polymer of polymers) {
      for (const initialCount of initialCounts) {
        for (let rep = 0; rep < 5; rep++) {
          // Before filtration
          const before = generateMeasurement(initialCount, polymer, 5.0, 488);
          
          // After filtration (size-dependent retention)
          const beforeSizes = generateParticleSizes(initialCount);
          const afterSizes = beforeSizes.filter(size => {
            const retentionProb = filterEfficiency * (1 - Math.exp(-size / 1000));
            return Math.random() > retentionProb;
          });
          
          const afterCount = afterSizes.length;
          const after = generateMeasurement(afterCount, polymer, 5.0, 488);
          
          const removalEff = (initialCount - afterCount) / initialCount;
          
          filtrationData.push({
            sample_id: filtrationId++,
            polymer_type: polymer,
            initial_particle_count: initialCount,
            final_particle_count: afterCount,
            before_digital_counts: before.digitalCounts,
            after_digital_counts: after.digitalCounts,
            before_analog_voltage: before.totalAnalog.toFixed(6),
            after_analog_voltage: after.totalAnalog.toFixed(6),
            removal_efficiency: (removalEff * 100).toFixed(2),
            replicate: rep + 1
          });
          
          setProgress(50 + Math.round((filtrationId / (polymers.length * initialCounts.length * 5)) * 50));
        }
      }
    }
    
    setFiltrationDataset(filtrationData);
    setProgress(100);
    setGenerating(false);
  };

  // Convert to CSV
  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  };

  // Download CSV
  const downloadCSV = (data, filename) => {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return React.createElement('div', { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8" },
    React.createElement('div', { className: "max-w-6xl mx-auto" },
      React.createElement('div', { className: "bg-white rounded-lg shadow-xl p-8" },
        React.createElement('h1', { className: "text-3xl font-bold text-gray-800 mb-2" },
          "Microplastic Fluorescence Dataset Generator"
        ),
        React.createElement('p', { className: "text-gray-600 mb-6" },
          "Generate realistic synthetic photodiode response data for Nile Red-stained microplastics"
        ),

        React.createElement('div', { className: "bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6" },
          React.createElement('div', { className: "flex items-start gap-3" },
            React.createElement(AlertCircle, { className: "text-blue-600 mt-0.5 flex-shrink-0", size: 20 }),
            React.createElement('div', { className: "text-sm text-blue-900" },
              React.createElement('p', { className: "font-semibold mb-1" }, "Dataset Specifications:"),
              React.createElement('ul', { className: "list-disc list-inside space-y-1 ml-2" },
                React.createElement('li', null, React.createElement('strong', null, "Main Dataset:"), " 1,344 samples (4 polymers × 7 concentrations × 4 Nile Red conc × 3 wavelengths × 3 replicates)"),
                React.createElement('li', null, React.createElement('strong', null, "Filtration Dataset:"), " 80 before/after pairs (4 polymers × 4 initial concentrations × 5 replicates)"),
                React.createElement('li', null, React.createElement('strong', null, "Features:"), " Realistic noise models, size distributions, polymer-specific properties")
              )
            )
          )
        ),

        React.createElement('button', {
          onClick: generateDataset,
          disabled: generating,
          className: "w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-4 rounded-lg transition-colors flex items-center justify-center gap-2 mb-6"
        },
          generating ? 
            React.createElement(React.Fragment, null,
              React.createElement('div', { className: "animate-spin rounded-full h-5 w-5 border-b-2 border-white" }),
              `Generating... ${progress}%`
            ) :
            React.createElement(React.Fragment, null,
              React.createElement(Play, { size: 20 }),
              "Generate Datasets"
            )
        ),

        generating && React.createElement('div', { className: "mb-6" },
          React.createElement('div', { className: "w-full bg-gray-200 rounded-full h-3 overflow-hidden" },
            React.createElement('div', {
              className: "bg-indigo-600 h-full transition-all duration-300 rounded-full",
              style: { width: `${progress}%` }
            })
          )
        ),

        dataset && filtrationDataset && !generating && React.createElement('div', { className: "space-y-4" },
          React.createElement('div', { className: "bg-green-50 border border-green-200 rounded-lg p-4" },
            React.createElement('div', { className: "flex items-center gap-3" },
              React.createElement(CheckCircle, { className: "text-green-600", size: 24 }),
              React.createElement('div', null,
                React.createElement('p', { className: "font-semibold text-green-900" }, "Datasets Generated Successfully!"),
                React.createElement('p', { className: "text-sm text-green-700" },
                  `Main dataset: ${dataset.length} samples | Filtration dataset: ${filtrationDataset.length} samples`
                )
              )
            )
          ),

          React.createElement('div', { className: "grid md:grid-cols-2 gap-4" },
            React.createElement('button', {
              onClick: () => downloadCSV(dataset, 'microplastic_main_dataset.csv'),
              className: "bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            },
              React.createElement(Download, { size: 20 }),
              "Download Main Dataset"
            ),
            React.createElement('button', {
              onClick: () => downloadCSV(filtrationDataset, 'microplastic_filtration_dataset.csv'),
              className: "bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            },
              React.createElement(Download, { size: 20 }),
              "Download Filtration Dataset"
            )
          )
        )
      )
    )
  );
};

ReactDOM.render(
  React.createElement(MicroplasticDatasetGenerator),
  document.getElementById('root')
);
```

---

## **PART 4: Enable GitHub Pages**

### **Step 1: Go to Settings**
1. In your repository, click **"Settings"** tab (top right, next to Insights)
2. In the left sidebar, scroll down and click **"Pages"** (under "Code and automation")

### **Step 2: Configure Pages**
1. Under **"Source"**, select **"Deploy from a branch"**
2. Under **"Branch"**:
   - Select **"main"** (or "master" if that's what yours says)
   - Leave folder as **"/ (root)"**
3. Click **"Save"**

### **Step 3: Wait for Deployment**
1. Refresh the page after 30-60 seconds
2. You'll see a box at the top that says: 
   > "Your site is live at https://yourusername.github.io/microplastic-generator/"
3. Click that link to visit your website!

---

## **PART 5: Using Your Website**

**Your website URL will be:**
