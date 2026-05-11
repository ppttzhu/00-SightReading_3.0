export class MusicXMLParser {
  private xmlDoc: Document | null = null;

  constructor(xmlString: string) {
    const parser = new DOMParser();
    this.xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    // Check for parsing errors
    const errorNode = this.xmlDoc.querySelector('parsererror');
    if (errorNode) {
      throw new Error("Invalid XML file");
    }
  }

  // 基础读取方法：获取所有的 <note> 元素
  public getNotes(): Element[] {
    if (!this.xmlDoc) return [];
    return Array.from(this.xmlDoc.getElementsByTagName('note'));
  }

  // 基础读取方法：获取所有的 <direction> (如力度记号等)
  public getDirections(): Element[] {
    if (!this.xmlDoc) return [];
    return Array.from(this.xmlDoc.getElementsByTagName('direction'));
  }

  // 基础读取方法：获取调号和拍号 <attributes>
  public getAttributes(): Element[] {
    if (!this.xmlDoc) return [];
    return Array.from(this.xmlDoc.getElementsByTagName('attributes'));
  }
}
