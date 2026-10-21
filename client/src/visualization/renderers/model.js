import {echarts} from './echartsCore.js';
import {ScatterChart,LineChart,BarChart,HeatmapChart,CustomChart,GraphChart} from 'echarts/charts';
import {MarkLineComponent} from 'echarts/components';
echarts.use([ScatterChart,LineChart,BarChart,HeatmapChart,CustomChart,GraphChart,MarkLineComponent]);
export {echarts};
