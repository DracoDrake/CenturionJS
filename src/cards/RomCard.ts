/**
 * RomCard.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import Card, { CardOptions } from "../Card";
import { DEBUG_Print } from "../Debug";
import Machine from "../Machine";
import fs from 'fs'

export interface RomOptions extends CardOptions {
    start_address: number,
    size: number,
    filename: string,
    buffer?: ArrayBuffer
}

export default class RomCard extends Card {
    options: RomOptions
    rom_buffer!: ArrayBuffer
    rom!: DataView

    constructor(machine: Machine, options: RomOptions) {
        super(machine, options)
        this.options = options
        if (options.buffer !== undefined) {
            this.setBuffer(options.buffer)
        }
        else {
            this.setBuffer(new ArrayBuffer(options.size))
        }
    }

    init() {
        super.init()

        var buffer = fs.readFileSync(this.options.filename)
        const data = new Uint8Array(buffer)

        for (let i = 0; i < this.options.size; i++)
            this.rom.setUint8(i, data[i])

        this.machine.registerAddressSpace(this, this.options.start_address, this.options.size)
    }

    reset() {
        super.reset()
    }

    setBuffer(buffer: ArrayBuffer) {
        this.rom_buffer = buffer 
        this.rom = new DataView(this.rom_buffer)
    }

    read_U8(addr: number): number {
        addr -= this.options.start_address
        return this.rom.getUint8(addr)
    }

    read_I8(addr: number): number {
        addr -= this.options.start_address
        return this.rom.getInt8(addr)
    }

    read_U16(addr: number): number {
        addr -= this.options.start_address
        return this.rom.getUint16(addr, false)
    }

    read_I16(addr: number): number {
        addr -= this.options.start_address
        return this.rom.getUint16(addr, false)
    }

    write_U8(addr: number, value: number) {
        DEBUG_Print("Attemped write to ROM at %04X of value %02X", addr, value)
    }
}
