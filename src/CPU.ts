/**
 * CPU.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */
import Card, { CardOptions } from "./Card"
import Machine from "./Machine"

export interface CPUOptions extends CardOptions {

}

export default class CPU extends Card {
    opcount

    constructor(machine: Machine, options: CPUOptions) {
        super(machine, options)
        this.opcount = 0
    }

    step(): boolean {
        this.opcount++

        return true
    }

    triggerInterrupt(interrupt: number) {

    }
} 