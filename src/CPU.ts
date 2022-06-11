/**
 * CPU.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */
import Card, { CardOptions } from "./Card"

export interface CPUOptions extends CardOptions {

}

export default class CPU extends Card {
    opcount

    constructor(options: CPUOptions) {
        super(options)
        this.opcount = 0
    }

    step(): boolean {
        this.opcount++

        return true
    }

    triggerInterrupt(interrupt: number) {

    }
} 