/**
 * RamCard.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import Card, { CardOptions } from "../Card";
import Machine from "../Machine";

export interface RamOptions extends CardOptions {
    start_address: number,
    size: number,
    buffer?: ArrayBuffer
}

export default class RamCard extends Card {
    options: RamOptions
    ram_buffer!: ArrayBuffer
    ram!: DataView

    constructor(machine: Machine, options: RamOptions) {
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
        this.machine.registerAddressSpace(this, this.options.start_address, this.options.size)
    }

    reset() {
        super.reset()
    }

    setBuffer(buffer: ArrayBuffer) {
        this.ram_buffer = buffer 
        this.ram = new DataView(this.ram_buffer)
    }

    read_U8(addr: number): number {
        addr -= this.options.start_address
        return this.ram.getUint8(addr)
    }
    
    read_I8(addr: number): number {
        addr -= this.options.start_address
        return this.ram.getInt8(addr)
    }
    
    read_U16(addr: number): number {
        addr -= this.options.start_address
        return this.ram.getUint16(addr, false)
    }
    
    read_I16(addr: number): number {
        addr -= this.options.start_address
        return this.ram.getUint16(addr, false)
    }
       
    write_U8(addr: number, value: number) {
        addr -= this.options.start_address
        this.ram.setUint8(addr, value)
    }
    
    write_I8(addr: number, value: number) {
        addr -= this.options.start_address
        this.ram.setInt8(addr, value)
    }
    
    write_U16(addr: number, value: number) {
        addr -= this.options.start_address
        this.ram.setUint16(addr, value, false)
    }
    
    write_I16(addr: number, value: number) {
        addr -= this.options.start_address
        this.ram.setInt16(addr, value, false)
    }    
}
