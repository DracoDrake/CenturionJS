
/**
 * MuxCard.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { DEBUG_Print } from "../Debug";
import Card, { CardOptions } from "../Card";
import Machine from "../Machine";

// process.on('SIGINT', () => {
//     in_q.push(0x03)
// });

export interface MuxStatus {
    parity_error: boolean,
    framing_error: boolean,
    overrun_error: boolean
    can_write: boolean,
    can_read: boolean
}

export enum MuxParity {
    NONE = 'N',
    EVEN = 'E',
    ODD = 'O',
} 

export type MuxReadCallback = (port: number) => number
export type MuxWriteCallback = (port: number, char: number) => void
export type MuxSetPortSettingsCallback = (port: number, baud: number, data_bits: number, stop_bits: number, parity: MuxParity) => void

export interface MuxOptions extends CardOptions {
    start_address: number,
    read_callback: MuxReadCallback,
    write_callback: MuxWriteCallback,
    set_port_settings: MuxSetPortSettingsCallback
}

enum ConfigBits {
    EPE = 0,			
    CLS2 = 1,
    CLS1 = 2,
    SBS = 3,
    PI = 4
}

const data_bits_table = [5, 6, 7, 8]

export default class Mux extends Card {
    options: MuxOptions
    interrupts_enabled = false
    interrupt_level = 0
    interrupt_flags = 0
    
    mux_status: MuxStatus[] = []

    constructor(machine: Machine, options: MuxOptions) {
        super(machine, options)
        this.options = options

        this.reset_status(0)
        this.reset_status(1)
        this.reset_status(2)
        this.reset_status(3)
    }

    init() {
        super.init()
        this.machine.registerAddressSpace(this, this.options.start_address, 0x20)
    }

    reset() {
        this.reset_status(0)
        this.reset_status(1)
        this.reset_status(2)
        this.reset_status(3)
        this.setCanWrite(0, true)
    }

    reset_status(port: number) {
        this.mux_status[port] = {
            parity_error: false,
            framing_error: false,
            overrun_error: false,
            can_write: false,
            can_read: false            
        }
    }

    write_U8(addr: number, value: number) {
        addr -= this.options.start_address
        //DEBUG_Print("MUX: %05X %02X\n", addr, value)
        if (addr == 0xE) {
            this.interrupts_enabled = true
            return
        }
    
        if (addr == 0xA) {
            this.interrupt_level = value
            DEBUG_Print("MUX Interrupt set to %d\n", this.interrupt_level)
            return
        }
        
        if (addr <= 0x8) {
            const port = (addr >> 1) & 0x3
            
            if (addr & 1) { // data
                this.options.write_callback(port, value & 0x7f)
            }
            else {
                let baud: number
                let data_bits: number
                let stop_bits: number
                let parity: MuxParity

                baud = 9600  // TODO

                if (value & ConfigBits.PI) {
                    parity = MuxParity.NONE
                }
                else if (value & ConfigBits.EPE) {
                    parity = MuxParity.EVEN
                }
                else {
                    parity = MuxParity.ODD
                }
                
                data_bits = data_bits_table[(value & ConfigBits.CLS2) << 1 | (value & ConfigBits.CLS1)]
                
                if (value & ConfigBits.SBS) {
                    stop_bits = 2
                }
                else {
                    stop_bits = 1
                }

                if (data_bits == 5 && stop_bits == 2) {
                    stop_bits = 1.5
                }

                this.options.set_port_settings(port, baud, data_bits, stop_bits, parity)
            }
        }
    }

    read_U8(addr: number): number {
        addr -= this.options.start_address
        
        if (addr == 0xF) {
            return this.interrupt_flags
        }

        if (addr <= 0x8) {
            const port = (addr >> 1) & 0x3
            
            if (addr & 1) { // data
                return this.options.read_callback(port)
            }
            else {
                let value = 0

                // bit0 can_read
                // bit1 can_write
                // bit2 PE
                // bit3 FE
                // bit4 OE
                // bit5 /Pin7
                // bit6 Unknown
                // bit7 Unknown
                
                if (this.mux_status[port].can_read)
                    value |= 1
                if (this.mux_status[port].can_write)
                    value |= 2
                if (this.mux_status[port].parity_error)
                    value |= 4
                if (this.mux_status[port].framing_error)
                    value |= 8
                if (this.mux_status[port].overrun_error)
                    value |= 16

                return value
            }
        }

        return 0xFF
    }

    setCanRead(port: number, value: boolean) {
        const new_char = value && !this.mux_status[port].can_read
        this.mux_status[port].can_read = value

        if (new_char && this.interrupts_enabled) {
            this.interrupt_flags = 0
            this.machine!.triggerInterrupt(this.interrupt_level)
        }
    }

    setCanWrite(port: number, value: boolean) {
        this.mux_status[port].can_write = value
    }

    setParityError(port: number, value: boolean) {
        this.mux_status[port].parity_error = value
    }

    setOverrunError(port: number, value: boolean) {
        this.mux_status[port].overrun_error = value
    }

    setFramingError(port: number, value: boolean) {
        this.mux_status[port].framing_error = value
    }

}

