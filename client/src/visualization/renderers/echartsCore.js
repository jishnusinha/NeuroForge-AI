import * as echarts from 'echarts/core';
import { SVGRenderer,CanvasRenderer } from 'echarts/renderers';
import { GridComponent,TooltipComponent,LegendComponent,DataZoomComponent,VisualMapComponent,BrushComponent,AriaComponent } from 'echarts/components';
echarts.use([SVGRenderer,CanvasRenderer,GridComponent,TooltipComponent,LegendComponent,DataZoomComponent,VisualMapComponent,BrushComponent,AriaComponent]);
export {echarts};
