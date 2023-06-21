/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import * as d3 from "d3";
import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";

export class Visual implements IVisual {
    private host: IVisualHost;
    private svgRoot: d3.Selection<SVGElement, any, HTMLElement, any>;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private selectionManager: powerbi.extensibility.ISelectionManager;
    private dotSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private xName: string;
    private yName: string;
    private catName: string;

    //Creates instance of ScatterPlot
    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
        this.svgRoot = d3.select(options.element).append("svg");
        this.selectionManager = options.host.createSelectionManager();
    }
    //Updates the state of the visual
    public update(options: VisualUpdateOptions) {
        console.log(options);
        this.svgRoot.selectAll("*").remove();
        let categorical = options.dataViews[0].categorical;

        if (//categorical?.categories?.length === 1 &&
            categorical?.values?.length === 2) {

            this.svgRoot
                .attr("width", options.viewport.width)
                .attr("height", options.viewport.height);

            let xAxis = <number[]>categorical.values[0].values;
            let yAxis = <number[]>categorical.values[1].values;
            this.xName = categorical.values[0].source.displayName;
            this.yName = categorical.values[1].source.displayName;
            //if any values in xAxis or yAxis are greater than a million, divide by a million and round to two decimal places
            if (xAxis.some(x => x > 1000000)) {
                xAxis = xAxis.map(x => Math.round((x / 1000000) * 1000) / 1000);
                this.xName = this.xName + " (in millions)";
            }
            if (yAxis.some(y => y > 1000000)) {
                yAxis = yAxis.map(y => Math.round((y / 1000000) * 1000) / 1000);
                this.yName = this.yName + " (in millions)";
            }
            //Round all values in xAxis and yAxis to three decimal places, if the decimals are all zeroes remove them
            xAxis = xAxis.map(x => Math.round(x * 1000) / 1000);
            yAxis = yAxis.map(y => Math.round(y * 1000) / 1000);
            if (xAxis.every(x => x % 1 === 0)) {
                xAxis = xAxis.map(x => Math.round(x));
            }
            if (yAxis.every(y => y % 1 === 0)) {
                yAxis = yAxis.map(y => Math.round(y));
            }
            let cats = categorical.categories?.[0].values;
            this.catName = categorical.categories?.[0].source.displayName;
            let data = xAxis.map((x, i) => {
                return { "x": x, "y": yAxis[i], "cat": cats ? cats[i] : "" }
            });
            // Get the min and max values for the x and y axis
            let xMin = Math.min(...xAxis);
            let xMax = Math.max(...xAxis);
            let yMin = Math.min(...yAxis);
            let yMax = Math.max(...yAxis);
            // Calculate the margin and height and width of the chart
            let xMargin = 50;
            let yMargin = 40;
            let height = options.viewport.height - yMargin;
            let width = options.viewport.width - xMargin;

            var x = d3.scaleLinear()
                .domain([xMin, xMax])
                .range([xMargin, width]);
            this.svgRoot.append("g")
                .attr("transform", "translate(0," + height + ")")
                .call(d3.axisBottom(x));

            var y = d3.scaleLinear()
                .domain([yMin, yMax])
                .range([height, yMargin]);
            this.svgRoot.append("g")
                .attr("transform", "translate(" + xMargin + ",0)")
                .call(d3.axisLeft(y));

            //On each axis add the name of the axis
            this.svgRoot.append("text")
                .attr("transform", "translate(" + (width / 2) + " ," + (height + 33) + ")")
                .style("text-anchor", "middle")
                .text(this.xName);

            this.svgRoot.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0)
                .attr("x", 0 - (height / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .text(this.yName);

            // Add dots
            this.svgRoot.append('g')
                .selectAll("dot")
                .data(data)
                .enter()
                .append("circle")
                .attr("cx", function (d) { return x(d.x); })
                .attr("cy", function (d) { return y(d.y); })
                .attr("r", 5.5)
                .style("fill", "#69b3a2");

            this.dotSelection = this.svgRoot
                .selectAll("circle")
                .data(data);

            this.tooltipServiceWrapper.addTooltip(this.dotSelection,
                (data: any) => this.getTooltipData(data));
        }
    }
    private getTooltipData = (data: any): VisualTooltipDataItem[] => {
        return [{
            displayName: this.catName + "\n" + this.xName + " :\n " + this.yName + ":",
            value: data.cat.toString() + "\n" + data.x.toString() + "\n" + data.y.toString(),
        }];
    }
}