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
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { VisualFormattingSettingsModel } from "./settings";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

export class Visual implements IVisual {
    private host: IVisualHost;
    private svgRoot: d3.Selection<SVGElement, any, HTMLElement, any>;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private visualSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private dotSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private xName: string;
    private yName: string;
    private catName: string;
    private xGivenFormat: string;
    private yGivenFormat: string;
    private xAxisValues: number[];
    private yAxisValues: number[];

    //Creates instance of ScatterPlot
    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.host = options.host;
        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
        this.svgRoot = d3.select(options.element).append("svg");
    }
    //Updates the state of the visual
    public update(options: VisualUpdateOptions) {

        this.svgRoot.selectAll("*").remove();
        let categorical = options.dataViews[0].categorical;
        if (categorical?.values?.length === 2) {
            this.svgRoot
                .attr("width", options.viewport.width)
                .attr("height", options.viewport.height);

            this.xAxisValues = <number[]>categorical.values[0].values;
            this.yAxisValues = <number[]>categorical.values[1].values;
            this.xName = categorical.values[0].source.displayName;
            this.yName = categorical.values[1].source.displayName;
            this.xGivenFormat = categorical.values[0].source.format;
            this.yGivenFormat = categorical.values[1].source.format;
            this.catName = categorical.categories?.[0].source.displayName;
            console.log(this.catName);

            let xFormat = this.createFormatter("x");
            let yFormat = this.createFormatter("y");
            let cats = categorical.categories?.[0].values;
            let data = this.xAxisValues.map((x, i) => {
                return { "x": x, "y": this.yAxisValues[i], "cat": cats ? cats[i] : "" }
            });

            this.visualSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews);
            // Get the min and max values for the x and y axis
            let xMin = Math.min(...this.xAxisValues);
            let xMax = Math.max(...this.xAxisValues);
            let yMin = Math.min(...this.yAxisValues);
            let yMax = Math.max(...this.yAxisValues);
            // Calculate the margin and height and width of the chart
            let xMargin = 50;
            let yMargin = 40;
            let height = options.viewport.height - yMargin;
            let width = options.viewport.width - xMargin;

            var x = d3.scaleLinear()
                .domain([xMin, xMax])
                .range([xMargin, width])
                .nice();
            var x_axis = d3.axisBottom(x).ticks(4)
                .tickFormat((d) => { return xFormat.format(d); });

            var y = d3.scaleLinear()
                .domain([yMin, yMax])
                .rangeRound([height, yMargin])
                .nice();
            var y_axis = d3.axisLeft(y).ticks(4)
                .tickFormat((d) => { return yFormat.format(d); });

            this.svgRoot.append("g")
                .attr("transform", "translate(0," + height + ")")
                .call(d3.axisBottom(x))
                .call(x_axis);

            this.svgRoot.append("g")
                .attr("transform", "translate(" + xMargin + ",0)")
                .call(d3.axisLeft(y))
                .call(y_axis);

            //On each axis add the name of the axis
            this.svgRoot.append("text")
                .attr("transform", "translate(" + (width / 2) + " ," + (height + 33) + ")")
                .style("text-anchor", "middle")
                .style("font-size", "12px")
                .text(this.xName);

            this.svgRoot.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0)
                .attr("x", 0 - (height / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("font-size", "12px")
                .text(this.yName);

            // Add dots
            this.svgRoot.append('g')
                .selectAll("dot")
                .data(data)
                .enter()
                .append("circle")
                .attr("cx", function (d) { return x(d.x); })
                .attr("cy", function (d) { return y(d.y); })
                .attr("r", this.visualSettings.dataPointCard.circleThickness.value)
                .style("fill", this.visualSettings.dataPointCard.defaultColor.value.value);

            this.dotSelection = this.svgRoot
                .selectAll("circle")
                .data(data);

            this.tooltipServiceWrapper.addTooltip(this.dotSelection,
                (data: any) => this.getTooltipData(data));
        }
    }
    private getTooltipData = (data: any): VisualTooltipDataItem[] => {
        let fX = valueFormatter.create({ format: this.xGivenFormat });
        let fY = valueFormatter.create({ format: this.yGivenFormat });
        let display = this.catName === undefined ? this.xName + "\n" + this.yName : this.catName + "\n" + this.xName + "\n" + this.yName;
        let values = this.catName === undefined ? fX.format(data.x) + "\n" + fY.format(data.y) : data.cat.toString() + "\n" + fX.format(data.x) + "\n" + fY.format(data.y);
        return [{
            displayName: display,
            value: values,
        }];
    }
    private createFormatter = (axis: string): valueFormatter.IValueFormatter => {
        let xFormat = valueFormatter.create({ format: this.xGivenFormat });
        let yFormat = valueFormatter.create({ format: this.yGivenFormat });
        if (axis === "x") {
            if (this.xAxisValues.some(x => x > 1000000)) {
                xFormat = valueFormatter.create({ value: 1000000, format: "0" });
            } else if (this.xAxisValues.some(x => x > 1000)) {
                xFormat = valueFormatter.create({ value: 1000, format: "0" });
            }
        } else if (axis === "y") {
            if (this.yAxisValues.some(x => x > 1000000)) {
                yFormat = valueFormatter.create({ value: 1000000, format: "0" });
            } else if (this.xAxisValues.some(x => x > 1000)) {
                yFormat = valueFormatter.create({ value: 1000, format: "0" });
            }
        }
        return axis === "x" ? xFormat : yFormat;
    }
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.visualSettings);
    }
}