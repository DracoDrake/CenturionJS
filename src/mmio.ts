/**
 * mmio.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { mark_memory_MMIO } from "./memory";

interface Device {
    start_addr: number,
    end_addr: number,
    read: Function,
    write: Function
}

let devices: Device[]

export function init_mmio() {
    devices = []
}

export function mmio_register(addr: number, len: number, read: Function, write: Function) {
    mark_memory_MMIO(addr, len)

    let device: Device = {
        start_addr: addr, 
        end_addr: addr + len - 1,
        read: read,
        write: write
    }

    devices.push(device)
}

// Memory Mapped I/O read

export function mmio_read_U8(addr: number): number {
    for(let device of devices) {
        if (addr >= device.start_addr && addr <= device.end_addr)
            return device.read(addr)
    }
    return 0
}

export function mmio_read_I8(addr: number): number {
    return mmio_read_U8(addr) << 24 >> 24
}

export function mmio_read_U16(addr: number): number {
    return mmio_read_U8(addr) << 8 | mmio_read_U8(addr + 1)
}

export function mmio_read_I16(addr: number): number {
    return mmio_read_I8(addr) << 8 | mmio_read_U8(addr + 1)
}

// Memory Mapped I/O write

export function mmio_write_U8(addr: number, value: number) {
    for(let device of devices) {
        if (addr >= device.start_addr && addr <= device.end_addr) {
            device.write(addr, value)
            return
        }
    }
    return 0
}

export function mmio_write_I8(addr: number, value: number) {
    mmio_write_U8(addr, value & 0xFF)
}

export function mmio_write_U16(addr: number, value: number) {
    mmio_write_U8(addr, value >> 8)
    mmio_write_U8(addr + 1, value & 0xFF)
}

export function mmio_write_I16(addr: number, value: number) {
    mmio_write_U8(addr, (value & 0xFFFF) >> 8)
    mmio_write_U8(addr + 1, value & 0xFF)
}

