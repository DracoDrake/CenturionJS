
/**
 * DiagnosticCard.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import Card, { CardOptions } from "../Card"
import Machine from "../Machine"

export type DiagDisplayCallback = (upper_digit: number, lower_digit: number, upper_dots: boolean[], lower_dots: boolean[], is_blank: boolean) => void

export interface DiagnosticOptions extends CardOptions {
    displayCallback: DiagDisplayCallback
}

export default class DiagnosticCard extends Card {
    switches: number = 0
    options: DiagnosticOptions
    hexdigits: number[] = [0,0]
    hexblank = true
    dots: boolean[] = [false, false, false, false]

    constructor(machine: Machine, options: DiagnosticOptions) {
        super(machine, options)
        this.options = options
    }

    init() {
        super.init()
        this.machine.registerAddressSpace(this, 0x3F106, 0x0F)
        this.machine.loadROM("./roms/Diag_F1_Rev_1.0.BIN", 0x08000, 0x0800)
        this.machine.loadROM("./roms/Diag_F2_Rev_1.0.BIN", 0x08800, 0x0800)
        this.machine.loadROM("./roms/Diag_F3_Rev_1.0.BIN", 0x09000, 0x0800)
        this.machine.loadROM("./roms/Diag_F4_1133CMD.BIN", 0x09800, 0x0800) 
        const aux_ram = this.machine.addAuxRAM(0xB800, 0x400)
        this.machine.addAuxRAMMirror(aux_ram, 0xBC00)       
    }

    reset() {
        super.reset()
    }

    setSwitches(switches: number) {
        this.switches = switches
    }

    read_U8(addr: number): number {
        addr -= 0x3F106

        if (addr == 0xA)
            return this.switches

        return 0
    }
    
    write_U8(addr: number, value: number) {
        addr -= 0x3F106

        if (addr == 0xA) {
            this.hexdigits[0] = value >> 4
            this.hexdigits[1] = value & 0xF
            this.runCallback()
            return
        } 

        const is_on = !!(addr & 1)
        addr >>= 1

        switch(addr) {
            case 0:
                this.hexblank = is_on
                break
            case 1:
            case 2:
            case 3:
            case 4:
                this.dots[addr-1] = is_on
                break
        }

        this.runCallback()
    }

    runCallback() {
        this.options.displayCallback(
            this.hexdigits[0], 
            this.hexdigits[1], 
            [this.dots[0], this.dots[1]],
            [this.dots[2], this.dots[3]],
            this.hexblank
        )
    }

}
