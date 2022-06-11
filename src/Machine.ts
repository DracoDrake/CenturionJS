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

    constructor() {

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
        }
        else {
            if (this.cards[slot] !== undefined) {
                throw new Error(`Cannot add card to slot ${slot} because already occupied`)
            }
            this.cards[slot] = card
        }
        card.init(this)
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
   
    // mapAddressSpace(card: Card, addr: number, len: number) {
    //     const block_start = addr >> 8
    //     const block_end = (len >> 8) + block_start
    
    //     for(let block = block_start; block < block_end; block++) {
    //         this.map[block] = []
    //         this.map[block][READ] = []
    //         this.map[block][READ][U8] = card.read_U8
    //         this.map[block][READ][I8] = card.read_I8
    //         this.map[block][READ][U16] = card.read_U16
    //         this.map[block][READ][I16] = card.read_I16
    //         this.map[block][WRITE] = []
    //         this.map[block][WRITE][U8] = card.write_U8
    //         this.map[block][WRITE][I8] = card.write_I8
    //         this.map[block][WRITE][U16] = card.write_U16
    //         this.map[block][WRITE][I16] = card.write_I16
    //         this.map_this[block] = card
    //     }
    // }
 
    // read_U8(addr: number): number {
    //     const block = addr >> 8
    //     return this.map[block][READ][U8].call(this.map_this[block], addr)
    // }
    
    // read_I8(addr: number): number {
    //     const block = addr >> 8
    //     return this.map[block][READ][I8].call(this.map_this[block], addr)
    // }
    
    // read_U16(addr: number): number {
    //     const block = addr >> 8
    //     return this.map[block][READ][U16].call(this.map_this[block], addr)
    // }
    
    // read_I16(addr: number) {
    //     const block = addr >> 8
    //     return this.map[block][READ][I16].call(this.map_this[block], addr)
    // }
    
    // write_U8(addr: number, value: number) {
    //     const block = addr >> 8
    //     this.map[block][WRITE][U8].call(this.map_this[block], addr, value)
    // }
    
    // write_I8(addr: number, value: number) {
    //     const block = addr >> 8
    //     this.map[block][WRITE][I8].call(this.map_this[block], addr, value)
    // }
    
    // write_U16(addr: number, value: number) {
    //     const block = addr >> 8
    //     this.map[block][WRITE][U16].call(this.map_this[block], addr, value)
    // }
    
    // write_I16(addr: number, value: number) {
    //     const block = addr >> 8
    //     this.map[block][WRITE][I16].call(this.map_this[block], addr, value)
    // }
    
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
        const card = new RomCard({start_address: addr, size: size, filename: filename})
        this.addCard(card, this.aux_slots++)
        return card
    }
     
    addAuxRAM(addr: number, size: number) {
        const card = new RamCard({start_address: addr, size: size})
        this.addCard(card, this.aux_slots++)
        return card
    }

    addAuxRAMMirror(card: RamCard, addr: number) {
        const mirror_card = new RamCard({start_address: addr, size: card.options.size, buffer: card.ram_buffer})
        this.addCard(mirror_card, this.aux_slots++)
        return card       
    }
}