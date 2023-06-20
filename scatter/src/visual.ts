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
import * as d3 from "d3";

export class Visual implements IVisual {

    private svgRoot: d3.Selection<SVGElement, any, HTMLElement, any>;

    constructor(options: VisualConstructorOptions) {
        this.svgRoot = d3.select(options.element).append("svg");
    }

    public update(options: VisualUpdateOptions) {
        this.svgRoot.selectAll("*").remove();
        let dataViewCategorical = options.dataViews[0].categorical;

        if (dataViewCategorical?.categories?.length === 1 &&
            dataViewCategorical?.values?.length === 2) {

            this.svgRoot
                .attr("width", options.viewport.width)
                .attr("height", options.viewport.height);

            let xAxis = <number[]>dataViewCategorical.values[0].values;
            let yAxis = <number[]>dataViewCategorical.values[1].values;
            let cats = dataViewCategorical.categories[0].values;

            let data = xAxis.map((x, i) => {
                return { "x": x, "y": yAxis[i], "cat": cats[i] }
            });

            let xMin = Math.min(...xAxis);
            let xMax = Math.max(...xAxis);
            let yMin = Math.min(...yAxis);
            let yMax = Math.max(...yAxis);
            let xMargin = 50;
            let yMargin = 30;
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

            // Add dots
            this.svgRoot.append('g')
                .selectAll("dot")
                .data(data)
                .enter()
                .append("circle")
                .attr("cx", function (d) { return x(d.x); })
                .attr("cy", function (d) { return y(d.y); })
                .attr("r", 5.5)
                .style("fill", "#69b3a2")
        }
    }
}