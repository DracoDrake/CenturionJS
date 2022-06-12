/**
 * Machine.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */
import Card from "./Card";
import RamCard from "./cards/RamCard";
import RomCard from "./cards/RomCard";
import CPU from "./CPU";

interface AddressReservation {
    start_addr: number,
    end_addr: number, 
    card: Card
}

const U8 = 0
const I8 = 1
const U16 = 2
const I16 = 3

const READ = 0
const WRITE = 1

export default class Machine {
    cards: Card[] = []
    map: Function[][][] = []
    map_this: Object[] = []

    addressReservations: AddressReservation[] = []
    aux_slots = 1000

    cpu: CPU | undefined
    steps: Function[] = []

    constructor() {
        // rom is on the backplane
        this.loadROM("./roms/bootstrap_unscrambled.bin", 0x3FC00, 0x0200)
    }

    reset() {
        this.cards.forEach(card => card.reset())
        this.cpu?.reset()
    }

    triggerInterrupt(interrupt: number) {
        this.cpu?.triggerInterrupt(interrupt)
    }

    addCard(card: Card, slot: number) {
        if (card instanceof CPU) {
            this.cpu = card
            this.registerStep(this.cpu.step.bind(this.cpu))
        }
        else {
            if (this.cards[slot] !== undefined) {
                throw new Error(`Cannot add card to slot ${slot} because already occupied`)
            }
            this.cards[slot] = card
        }
        card.init()
    }

    registerAddressSpace(card: Card, addr: number, len: number) {
        // this.mapAddressSpace(card, addr, len)

        let reservation: AddressReservation = {
            start_addr: addr, 
            end_addr: addr + len - 1,
            card: card
        }

        this.addressReservations.push(reservation)
    }
   
    registerStep(step_func: Function) {
        this.steps.push(step_func)
    }

    read_U8(addr: number): number {
        for(const reservation of this.addressReservations) {
            if (addr >= reservation.start_addr && addr <= reservation.end_addr) {
                return reservation.card.read_U8.call(reservation.card, addr)
            }
        }
        return 0xFF
    }
    
    read_I8(addr: number): number {
        for(const reservation of this.addressReservations) {
            if (addr >= reservation.start_addr && addr <= reservation.end_addr) {
                return reservation.card.read_I8.call(reservation.card, addr)
            }
        }
        return -1
    }
    
    read_U16(addr: number): number {
        for(const reservation of this.addressReservations) {
            if (addr >= reservation.start_addr && addr <= reservation.end_addr) {
                return reservation.card.read_U16.call(reservation.card, addr)
            }
        }
        return 0xFFFF
    }
    
    read_I16(addr: number) {
        for(const reservation of this.addressReservations) {
            if (addr >= reservation.start_addr && addr <= reservation.end_addr) {
                return reservation.card.read_I16.call(reservation.card, addr)
            }
        }
        return -1
    }
    
    write_U8(addr: number, value: number) {
        for(const reservation of this.addressReservations) {
            if (addr >= reservation.start_addr && addr <= reservation.end_addr) {
                reservation.card.write_U8.call(reservation.card, addr, value)
            }
        }
    }
    
    write_I8(addr: number, value: number) {
        for(const reservation of this.addressReservations) {
            if (addr >= reservation.start_addr && addr <= reservation.end_addr) {
                reservation.card.write_I8.call(reservation.card, addr, value)
            }
        }
    }
    
    write_U16(addr: number, value: number) {
        for(const reservation of this.addressReservations) {
            if (addr >= reservation.start_addr && addr <= reservation.end_addr) {
                reservation.card.write_U16.call(reservation.card, addr, value)
            }
        }
    }
    
    write_I16(addr: number, value: number) {
        for(const reservation of this.addressReservations) {
            if (addr >= reservation.start_addr && addr <= reservation.end_addr) {
                reservation.card.write_I16.call(reservation.card, addr, value)
            }
        }
    }

    loadROM(filename: string, addr: number, size: number) {
        const card = new RomCard(this, {start_address: addr, size: size, filename: filename})
        this.addCard(card, this.aux_slots++)
        return card
    }
     
    addAuxRAM(addr: number, size: number) {
        const card = new RamCard(this, {start_address: addr, size: size})
        this.addCard(card, this.aux_slots++)
        return card
    }

    addAuxRAMMirror(card: RamCard, addr: number) {
        const mirror_card = new RamCard(this, {start_address: addr, size: card.options.size, buffer: card.ram_buffer})
        this.addCard(mirror_card, this.aux_slots++)
        return card       
    }

    step() {
        this.steps.forEach(step => {
            step()
        })
    }

    dma_read_cycle(data: number[]) {
        return true
    }
}