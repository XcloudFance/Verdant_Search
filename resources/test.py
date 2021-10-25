def ordered_set(old_list):  # 有序去重
    new_list = list(set(old_list))
    new_list.sort(key=old_list.index)
    return new_list

b = [4,3,2,4,3,2,1]
print(ordered_set(b))
